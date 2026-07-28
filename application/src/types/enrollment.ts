export interface ProgramField {
  id: string;
  name: string;
  crop: string;
  farmName: string;
  enrolled: boolean;
}

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
  alreadyEnrolled: boolean;
  fields: ProgramField[];
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

/** Result of a farmer removing one of their own fields from a program. */
export interface UnenrollFieldResult {
  programId: string;
  fieldId: string;
  unenrolled: boolean;
  /** True when that was the farmer's last field, so the whole enrollment went. */
  enrollmentRemoved: boolean;
}
