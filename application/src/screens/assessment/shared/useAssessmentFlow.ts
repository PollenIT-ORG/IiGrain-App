import { useAssessorAssessmentFlow } from './useAssessorAssessmentFlow';
import { useFarmerAssessmentFlow } from './useFarmerAssessmentFlow';
import type { AssessmentFlow, AssessmentRole } from './flowTypes';

export const useAssessmentFlow = (
  role: AssessmentRole,
  programId: string,
  fieldId: string,
): AssessmentFlow => {
  const farmer = useFarmerAssessmentFlow(programId, fieldId);
  const assessor = useAssessorAssessmentFlow(programId, fieldId);
  return role === 'assessor' ? assessor : farmer;
};
