import type { NotificationRedirect } from '../../types/notification';

/** A resolved navigation target: the route name plus its params, or null when
 *  the notification has nothing specific to open. */
export type NotificationTarget = { screen: string; params?: object } | null;

/**
 * Maps the backend's stable `redirect.screen` key onto this app's routes.
 * `visit_tracking` is the one key whose destination depends on who is looking:
 * the farmer watches the assessor, the assessor runs the visit.
 */
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
        ? {
            screen: 'AssessorComparison',
            params: { programId, fieldId },
          }
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
