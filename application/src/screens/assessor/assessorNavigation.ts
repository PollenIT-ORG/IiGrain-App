import { CommonActions } from '@react-navigation/native';
import type {
  FieldSummaryTarget,
  ResetCapableNavigation,
} from '../assessment/assessmentNavigation';

export const resetToAssessorHome = (navigation: ResetCapableNavigation): void => {
  navigation.dispatch(
    CommonActions.reset({
      index: 0,
      routes: [{ name: 'AssessorShell', params: { screen: 'AssessorHome' } }],
    }),
  );
};

export const resetToAssessorVisit = (
  navigation: ResetCapableNavigation,
  visitId: string,
): void => {
  navigation.dispatch(
    CommonActions.reset({
      index: 1,
      routes: [
        { name: 'AssessorShell', params: { screen: 'AssessorHome' } },
        { name: 'AssessorVisit', params: { visitId } },
      ],
    }),
  );
};

export const resetToAssessorFieldSummary = (
  navigation: ResetCapableNavigation,
  target: FieldSummaryTarget,
): void => {
  navigation.dispatch(
    CommonActions.reset({
      index: 1,
      routes: [
        { name: 'AssessorShell', params: { screen: 'AssessorHome' } },
        { name: 'AssessorAssessmentSummary', params: target },
      ],
    }),
  );
};
