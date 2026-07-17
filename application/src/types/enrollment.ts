export interface AvailableProgram {
  id: string;
  name: string;
  code: string;
  description: string | null;
  type: string;
  startDateISO: string | null;
  endDateISO: string | null;
  userLimit: number | null;
  enrolledCount: number;
  isFull: boolean;
}

export interface EnrollableField {
  id: string;
  name: string;
  crop: string;
  farmName: string;
}

export interface EnrollSelfInput {
  fieldIds: string[];
  note?: string;
}

export interface EnrolledField {
  id: string;
  fieldId: string;
  fieldName: string;
  farmName: string;
}

export interface EnrollmentResult {
  id: string;
  programId: string;
  status: string;
  note: string | null;
  enrolledAtISO: string;
  fields: EnrolledField[];
}
