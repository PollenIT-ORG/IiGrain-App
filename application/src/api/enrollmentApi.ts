import http from '../services/http';
import { Endpoints } from '../config/endpoints';
import type {
  AvailableProgram,
  EnrollableField,
  EnrolledField,
  EnrollmentResult,
  EnrollSelfInput,
} from '../types/enrollment';

interface Envelope<T> {
  data: T;
}

interface RawProgram {
  id: string;
  name: string;
  code: string;
  description: string | null;
  type: string;
  start_date: string | null;
  end_date: string | null;
  user_limit: number | null;
  enrolled_count: number;
  is_full: boolean;
}
interface AvailableProgramsPayload {
  programs: RawProgram[];
}

interface RawEnrollableField {
  id: string;
  name: string;
  crop: string;
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
  return (res.data.data.programs ?? []).map(mapProgram);
};

export const getEnrollableFields = async (): Promise<EnrollableField[]> => {
  trace('GET enrollableFields', { url: Endpoints.programs.enrollableFields });
  const res = await http.get<Envelope<EnrollableFieldsPayload>>(
    Endpoints.programs.enrollableFields,
  );
  return (res.data.data.fields ?? []).map(mapEnrollableField);
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
