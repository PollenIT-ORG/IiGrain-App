import http from '../services/http';
import {
  MAX_PAGE_LIMIT,
  normalizePageMeta,
  toPageParams,
  type PageMeta,
  type PageQuery,
  type RawPageMeta,
} from '../types/pagination';
import { Endpoints } from '../config/endpoints';
import { isOpenableUrl } from '../utils/openExternalUrl';
import type {
  AvailableProgram,
  EnrollableField,
  EnrolledField,
  EnrollmentResult,
  EnrollSelfInput,
  ProgramField,
  UnenrollFieldResult,
} from '../types/enrollment';

const MAX_FIELD_PAGES = 20;

interface Envelope<T> {
  data: T;
  meta?: RawPageMeta;
}

interface RawProgramField {
  id: string;
  name: string;
  crop: string | null;
  farm_name: string | null;
  enrolled: boolean;
}

interface RawProgram {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  type: string | null;
  start_date: string | null;
  end_date: string | null;
  user_limit: number | null;
  enrolled_count: number;
  is_full: boolean;
  already_enrolled?: boolean;
  can_enroll?: boolean;
  canEnroll?: boolean;
  enrollment_id?: string | null;
  enrollmentId?: string | null;
  survey_url?: string | null;
  surveyUrl?: string | null;
  survey_acres?: number | string | null;
  surveyAcres?: number | string | null;
  fields?: RawProgramField[] | null;
}
interface AvailableProgramsPayload {
  programs: RawProgram[];
}

interface RawEnrollableField {
  id: string;
  name: string;
  crop: string | null;
  farm_name: string;
}
interface EnrollableFieldsPayload {
  fields: RawEnrollableField[];
}

interface RawEnrolledField {
  id: string;
  field_id: string;
  field_name: string;
  farm_name: string;
}
interface RawEnrollment {
  id: string;
  program_id: string;
  status: string;
  note: string | null;
  enrolled_at: string;
  fields: RawEnrolledField[];
}
interface EnrollSelfPayload {
  enrollment: RawEnrollment;
}

const mapProgramField = (raw: RawProgramField): ProgramField => ({
  id: raw.id,
  name: raw.name ?? '',
  crop: raw.crop ?? '',
  farmName: raw.farm_name ?? '',
  enrolled: !!raw.enrolled,
});

const readCanEnroll = (raw: RawProgram): boolean => {
  const value = raw.can_enroll ?? raw.canEnroll;
  return typeof value === 'boolean' ? value : true;
};

const readEnrollmentId = (raw: RawProgram): string | null => {
  const value = raw.enrollment_id ?? raw.enrollmentId;
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const readSurveyUrl = (raw: RawProgram): string | null => {
  const value = (raw.survey_url ?? raw.surveyUrl ?? '').trim();
  return isOpenableUrl(value) ? value : null;
};

const readSurveyAcres = (raw: RawProgram): number | null => {
  const value = raw.survey_acres ?? raw.surveyAcres;
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const acres = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(acres) && acres > 0 ? acres : null;
};

const mapProgram = (raw: RawProgram): AvailableProgram => ({
  id: raw.id,
  name: raw.name ?? '',
  code: raw.code ?? '',
  description: raw.description ?? null,
  type: raw.type ?? '',
  startDateISO: raw.start_date ?? null,
  endDateISO: raw.end_date ?? null,
  userLimit: raw.user_limit ?? null,
  enrolledCount: raw.enrolled_count ?? 0,
  isFull: !!raw.is_full,
  alreadyEnrolled: !!raw.already_enrolled,
  canEnroll: readCanEnroll(raw),
  enrollmentId: readEnrollmentId(raw),
  surveyUrl: readSurveyUrl(raw),
  surveyAcres: readSurveyAcres(raw),
  fields: (raw.fields ?? []).map(mapProgramField),
});

const mapEnrollableField = (raw: RawEnrollableField): EnrollableField => ({
  id: raw.id,
  name: raw.name ?? '',
  crop: raw.crop ?? '',
  farmName: raw.farm_name ?? '',
});

const mapEnrolledField = (raw: RawEnrolledField): EnrolledField => ({
  id: raw.id,
  fieldId: raw.field_id,
  fieldName: raw.field_name ?? '',
  farmName: raw.farm_name ?? '',
});

const mapEnrollment = (raw: RawEnrollment): EnrollmentResult => ({
  id: raw.id,
  programId: raw.program_id,
  status: raw.status ?? '',
  note: raw.note ?? null,
  enrolledAtISO: raw.enrolled_at,
  fields: (raw.fields ?? []).map(mapEnrolledField),
});

const trace = (label: string, payload: Record<string, unknown>): void => {
  if (__DEV__) {
    console.log(`[enrollmentApi] ${label} →`, payload);
  }
};

export const getAvailablePrograms = async (): Promise<AvailableProgram[]> => {
  trace('GET available', { url: Endpoints.programs.available });
  const res = await http.get<Envelope<AvailableProgramsPayload>>(Endpoints.programs.available);
  const raw = res.data.data.programs;
  trace('GET available ← raw response', {
    count: raw?.length ?? 0,
    isArray: Array.isArray(raw),
    programs: raw,
  });
  return (raw ?? []).map(mapProgram);
};

const getEnrollableFieldsPage = async (
  page: number,
): Promise<{ fields: EnrollableField[]; meta: PageMeta }> => {
  const query: PageQuery = { page, limit: MAX_PAGE_LIMIT };
  const res = await http.get<Envelope<EnrollableFieldsPayload>>(
    Endpoints.programs.enrollableFields,
    { params: toPageParams(query) },
  );
  const fields = (res.data.data.fields ?? []).map(mapEnrollableField);
  return { fields, meta: normalizePageMeta(res.data.meta, fields.length, query) };
};

export const getEnrollableFields = async (): Promise<EnrollableField[]> => {
  trace('GET enrollableFields', { url: Endpoints.programs.enrollableFields });
  const first = await getEnrollableFieldsPage(1);
  const all = [...first.fields];
  for (let page = 2; page <= first.meta.totalPages && page <= MAX_FIELD_PAGES; page += 1) {
    const next = await getEnrollableFieldsPage(page);
    all.push(...next.fields);
  }
  return all;
};

export const enrollSelf = async (
  programId: string,
  input: EnrollSelfInput,
): Promise<EnrollmentResult> => {
  trace('POST enrollSelf', {
    url: Endpoints.programs.enrollSelf(programId),
    programId,
    body: input,
  });
  const res = await http.post<Envelope<EnrollSelfPayload>>(
    Endpoints.programs.enrollSelf(programId),
    input,
  );
  return mapEnrollment(res.data.data.enrollment);
};

interface RawUnenrollPayload {
  programId?: string;
  fieldId?: string;
  unenrolled?: boolean;
  enrollmentRemoved?: boolean;
  enrollment_removed?: boolean;
}

export const unenrollField = async (
  programId: string,
  fieldId: string,
): Promise<UnenrollFieldResult> => {
  trace('DELETE unenrollField', { programId, fieldId });
  const res = await http.delete<Envelope<RawUnenrollPayload>>(
    Endpoints.programs.unenrollField(programId, fieldId),
    { silent: true },
  );
  const raw = res.data.data ?? {};
  return {
    programId: raw.programId ?? programId,
    fieldId: raw.fieldId ?? fieldId,
    unenrolled: raw.unenrolled ?? true,
    enrollmentRemoved: raw.enrollmentRemoved ?? raw.enrollment_removed ?? false,
  };
};
