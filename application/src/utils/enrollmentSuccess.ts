import type { EnrollmentResult } from '../types/enrollment';

export interface JoinedField {
  fieldId: string;
  fieldName: string;
  farmName: string;
}

export interface EnrollmentSuccess {
  programId: string;
  programName: string;
  fields: JoinedField[];
}

export interface KnownField {
  id: string;
  name: string;
  farmName: string;
}

export interface EnrollmentRequest {
  programId: string;
  programName: string;
  fieldIds: readonly string[];
  knownFields: readonly KnownField[];
}

export const toEnrollmentSuccess = (
  result: EnrollmentResult,
  request: EnrollmentRequest,
): EnrollmentSuccess => {
  const confirmed = request.fieldIds.filter(id =>
    result.fields.some(field => field.fieldId === id),
  );
  const joinedIds = confirmed.length > 0 ? confirmed : request.fieldIds;

  return {
    programId: result.programId || request.programId,
    programName: request.programName,
    fields: joinedIds.map(id => {
      const enrolled = result.fields.find(field => field.fieldId === id);
      const known = request.knownFields.find(field => field.id === id);
      return {
        fieldId: id,
        fieldName: enrolled?.fieldName || known?.name || '',
        farmName: enrolled?.farmName || known?.farmName || '',
      };
    }),
  };
};
