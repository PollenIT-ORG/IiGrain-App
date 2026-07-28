import http from '../services/http';
import { Endpoints } from '../config/endpoints';
import { FIELD_HEALTH_META, type Field, type FieldHealth } from '../types/farm';

interface Envelope<T> {
  data: T;
}

interface RawField {
  id: string;
  farm_id?: string;
  farmId?: string;
  name?: string;
  area_acres?: string | number;
  areaAcres?: string | number;
  crop?: string;
  season?: string;
  status?: string;
  location?: string;
  coordinates?: string;
  latitude?: number | string | null;
  longitude?: number | string | null;
  irrigation?: string;
  sowing_date?: string;
  sowingDate?: string;
  expected_harvest?: string;
  expectedHarvest?: string;
  weather?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CreateFieldInput {
  name: string;
  areaAcres?: number;
  crop?: string;
  season?: string;
  irrigation?: string;
  location?: string;
  latitude?: number | null;
  longitude?: number | null;
  sowingDate?: string;
  expectedHarvest?: string;
  status?: FieldHealth;
}

export interface UpdateFieldInput {
  name?: string;
  areaAcres?: number | null;
  crop?: string | null;
  season?: string | null;
  irrigation?: string | null;
  location?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  sowingDate?: string | null;
  expectedHarvest?: string | null;
  status?: FieldHealth;
}

const VALID_STATUSES: readonly FieldHealth[] = ['healthy', 'monitor', 'critical'];

const toFieldHealth = (raw?: string): FieldHealth =>
  VALID_STATUSES.includes(raw as FieldHealth) ? (raw as FieldHealth) : 'healthy';

const toArea = (value?: string | number): number => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  return value ? parseFloat(value) || 0 : 0;
};

const toNumberOrNull = (value?: number | string | null): number | null => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const n = typeof value === 'number' ? value : parseFloat(value);
  return Number.isFinite(n) ? n : null;
};

const mapField = (raw: RawField, fallbackFarmId: string): Field => {
  const status = toFieldHealth(raw.status);
  return {
    id: raw.id,
    farmId: raw.farmId ?? raw.farm_id ?? fallbackFarmId,
    name: raw.name ?? '',
    areaAcres: toArea(raw.areaAcres ?? raw.area_acres),
    crop: raw.crop ?? '—',
    season: raw.season ?? '—',
    status,
    coordinates: raw.coordinates ?? raw.location ?? '—',
    latitude: toNumberOrNull(raw.latitude),
    longitude: toNumberOrNull(raw.longitude),
    sowingDateISO: raw.sowingDate ?? raw.sowing_date ?? '',
    expectedHarvestISO: raw.expectedHarvest ?? raw.expected_harvest ?? '',
    irrigation: raw.irrigation ?? '—',
    weather: raw.weather ?? '—',
    healthLabel: FIELD_HEALTH_META[status].label,
  };
};

const extractFieldList = (data: unknown): RawField[] => {
  if (Array.isArray(data)) {
    return data as RawField[];
  }
  if (data && typeof data === 'object') {
    const fields = (data as { fields?: unknown }).fields;
    if (Array.isArray(fields)) {
      return fields as RawField[];
    }
  }
  return [];
};

const extractField = (data: unknown): RawField | null => {
  if (data && typeof data === 'object') {
    const nested = (data as { field?: RawField }).field;
    if (nested && typeof nested === 'object') {
      return nested;
    }
    if ('id' in (data as Record<string, unknown>)) {
      return data as RawField;
    }
  }
  return null;
};

export const getFarmFields = async (farmId: string): Promise<Field[]> => {
  const res = await http.get<Envelope<unknown>>(Endpoints.farms.fields(farmId));
  return extractFieldList(res.data.data).map(raw => mapField(raw, farmId));
};

export const getFarmField = async (
  farmId: string,
  fieldId: string,
): Promise<Field | null> => {
  const res = await http.get<Envelope<unknown>>(
    Endpoints.farms.field(farmId, fieldId),
  );
  const raw = extractField(res.data.data);
  return raw ? mapField(raw, farmId) : null;
};

const toCreateFieldBody = (
  input: CreateFieldInput,
): Record<string, string | number | null> => {
  const body: Record<string, string | number | null> = { name: input.name.trim() };
  const setText = (key: string, value?: string): void => {
    const v = value?.trim();
    if (v) {
      body[key] = v;
    }
  };
  if (input.areaAcres !== undefined) {
    body.areaAcres = input.areaAcres;
  }
  setText('crop', input.crop);
  setText('season', input.season);
  setText('irrigation', input.irrigation);
  setText('location', input.location);
  if (input.latitude !== undefined) {
    body.latitude = input.latitude;
  }
  if (input.longitude !== undefined) {
    body.longitude = input.longitude;
  }
  setText('sowingDate', input.sowingDate);
  setText('expectedHarvest', input.expectedHarvest);
  return body;
};

export const createFarmField = async (
  farmId: string,
  input: CreateFieldInput,
): Promise<Field> => {
  const res = await http.post<Envelope<unknown>>(
    Endpoints.farms.fields(farmId),
    toCreateFieldBody(input),
  );
  const raw = extractField(res.data.data);
  if (!raw) {
    throw new Error('Field creation did not return the created field.');
  }
  return mapField(raw, farmId);
};

const toUpdateFieldBody = (
  input: UpdateFieldInput,
): Record<string, string | number | null> => {
  const body: Record<string, string | number | null> = {};
  if (input.name !== undefined) {
    body.name = input.name.trim();
  }
  if (input.areaAcres !== undefined) {
    body.areaAcres = input.areaAcres;
  }
  if (input.crop !== undefined) {
    body.crop = input.crop;
  }
  if (input.season !== undefined) {
    body.season = input.season;
  }
  if (input.irrigation !== undefined) {
    body.irrigation = input.irrigation;
  }
  if (input.location !== undefined) {
    body.location = input.location;
  }
  if (input.latitude !== undefined) {
    body.latitude = input.latitude;
  }
  if (input.longitude !== undefined) {
    body.longitude = input.longitude;
  }
  if (input.sowingDate !== undefined) {
    body.sowingDate = input.sowingDate;
  }
  if (input.expectedHarvest !== undefined) {
    body.expectedHarvest = input.expectedHarvest;
  }
  return body;
};

export const updateFarmField = async (
  farmId: string,
  fieldId: string,
  input: UpdateFieldInput,
): Promise<Field> => {
  const res = await http.patch<Envelope<unknown>>(
    Endpoints.farms.field(farmId, fieldId),
    toUpdateFieldBody(input),
  );
  const raw = extractField(res.data.data);
  if (!raw) {
    throw new Error('Field update did not return the updated field.');
  }
  return mapField(raw, farmId);
};

/** Clears the field's editable data but keeps its identity. No guards. */
export const resetFarmField = async (
  farmId: string,
  fieldId: string,
): Promise<Field | null> => {
  const res = await http.post<Envelope<unknown>>(
    Endpoints.farms.resetField(farmId, fieldId),
  );
  const raw = extractField(res.data.data);
  return raw ? mapField(raw, farmId) : null;
};

/** Soft-delete. Rejects with 409 when the field has a submitted assessment or is
 *  still enrolled in a program; the message explains which. */
export const deleteFarmField = async (
  farmId: string,
  fieldId: string,
): Promise<void> => {
  await http.delete(Endpoints.farms.field(farmId, fieldId));
};
