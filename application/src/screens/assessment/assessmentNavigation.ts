import { CommonActions, type NavigationAction } from '@react-navigation/native';

export interface FieldSummaryTarget {
  programId: string;
  fieldId: string;
  fieldName?: string;
}

export interface ResetCapableNavigation {
  dispatch: (action: NavigationAction) => void;
}

export const resetToAssessmentTab = (navigation: ResetCapableNavigation): void => {
  navigation.dispatch(
    CommonActions.reset({
      index: 0,
      routes: [
        {
          name: 'Shell',
          params: { screen: 'MainTabs', params: { screen: 'Assessment' } },
        },
      ],
    }),
  );
};

export const resetToFieldSummary = (
  navigation: ResetCapableNavigation,
  target: FieldSummaryTarget,
): void => {
  navigation.dispatch(
    CommonActions.reset({
      index: 1,
      routes: [
        {
          name: 'Shell',
          params: { screen: 'MainTabs', params: { screen: 'Assessment' } },
        },
        { name: 'AssessmentFieldSummary', params: target },
      ],
    }),
  );
};
