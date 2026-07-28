import http from '../services/http';
import { Endpoints } from '../config/endpoints';
import type { SaveSoilInput, SoilRecord } from '../types/fieldDetails';

interface Envelope<T> {
  data: T;
}

interface RawSoil {
  ph: string | number | null;
  organic_matter: string | number | null;
  nitrogen: string | number | null;
  phosphorus: string | number | null;
  potassium: string | number | null;
  moisture: string | number | null;
  texture: string | null;
  notes: string | null;
  tested_on: string | null;
}
interface SoilPayload {
  soil: RawSoil | null;
  locked?: boolean;
}

/** `locked` is true until the field is enrolled in a started program; while it is
 *  true the backend rejects any nutrient value with a 403. */
export interface SoilRecordResult {
  record: SoilRecord;
  locked: boolean;
}

const toNum = (raw: string | number | null | undefined): number | null => {
  if (raw === null || raw === undefined || raw === '') {
    return null;
  }
  const n = typeof raw === 'number' ? raw : Number.parseFloat(raw);
  return Number.isFinite(n) ? n : null;
};

const EMPTY_SOIL: SoilRecord = {
  ph: null,
  organicMatter: null,
  nitrogen: null,
  phosphorus: null,
  potassium: null,
  moisture: null,
  texture: '',
  notes: '',
  testedOnISO: null,
};

const mapSoilRecord = (raw: RawSoil): SoilRecord => ({
  ph: toNum(raw.ph),
  organicMatter: toNum(raw.organic_matter),
  nitrogen: toNum(raw.nitrogen),
  phosphorus: toNum(raw.phosphorus),
  potassium: toNum(raw.potassium),
  moisture: toNum(raw.moisture),
  texture: raw.texture ?? '',
  notes: raw.notes ?? '',
  testedOnISO: raw.tested_on ?? null,
});

const toSoilBody = (input: SaveSoilInput): Record<string, unknown> => {
  const body: Record<string, unknown> = {};
  if (input.ph !== undefined) body.ph = input.ph;
  if (input.organicMatter !== undefined) body.organicMatter = input.organicMatter;
  if (input.nitrogen !== undefined) body.nitrogen = input.nitrogen;
  if (input.phosphorus !== undefined) body.phosphorus = input.phosphorus;
  if (input.potassium !== undefined) body.potassium = input.potassium;
  if (input.moisture !== undefined) body.moisture = input.moisture;
  if (input.texture !== undefined) body.texture = input.texture;
  if (input.notes !== undefined) body.notes = input.notes;
  if (input.testedOn !== undefined) body.testedOn = input.testedOn;
  return body;
};

const toResult = (payload: SoilPayload): SoilRecordResult => ({
  record: payload.soil ? mapSoilRecord(payload.soil) : { ...EMPTY_SOIL },
  locked: payload.locked ?? false,
});

export const getFieldSoilRecord = async (
  fieldId: string,
): Promise<SoilRecordResult> => {
  const res = await http.get<Envelope<SoilPayload>>(Endpoints.fields.soil(fieldId), {
    silent: true,
  });
  return toResult(res.data.data);
};

export const saveFieldSoil = async (
  fieldId: string,
  input: SaveSoilInput,
): Promise<SoilRecordResult> => {
  const res = await http.put<Envelope<SoilPayload>>(
    Endpoints.fields.soil(fieldId),
    toSoilBody(input),
  );
  return toResult(res.data.data);
};
