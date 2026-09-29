import type { NotificationRedirect } from '../../types/notification';

export type NotificationTarget = { screen: string; params?: object } | null;

export const targetForRedirect = (
  redirect: NotificationRedirect | undefined,
  isAssessor: boolean,
): NotificationTarget => {
  if (!redirect) {
    return null;
  }
  const { screen, programId, fieldId, visitId } = redirect;

  switch (screen) {
    case 'available_programs':
      return { screen: 'EnrollNow' };

    case 'my_assessments':
      return { screen: 'Assessment' };

    case 'assessment_history':
      return programId && fieldId
        ? {
            screen: 'AssessmentReview',
            params: { programId, fieldId, locked: true },
          }
        : { screen: 'Assessment' };

    case 'assessor_field_assessment':
      return programId && fieldId
        ? {
            screen: 'AssessorAssessmentSummary',
            params: { programId, fieldId },
          }
        : null;

    case 'assessment_comparison':
      return programId && fieldId
        ? isAssessor
          ? { screen: 'AssessorComparison', params: { programId, fieldId } }
          : { screen: 'FarmerComparison', params: { programId, fieldId } }
        : null;

    case 'visit_tracking':
      return isAssessor
        ? { screen: 'AssessorVisit', params: visitId ? { visitId } : undefined }
        : {
            screen: 'FarmerVisitTracking',
            params: visitId ? { visitId } : undefined,
          };

    default:
      return null;
  }
};
