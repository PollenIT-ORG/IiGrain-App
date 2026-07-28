import { CommonActions, type NavigationProp } from '@react-navigation/native';
import type { AppStackParamList } from '../../navigation/navigationTypes';

export interface FieldSummaryTarget {
  programId: string;
  fieldId: string;
  fieldName?: string;
}

/**
 * Collapse the assessment stack back to a clean two-level trail:
 *
 *   Assessment tab  →  this field's summary (the category list)
 *
 * Plain `navigate` is not enough here. Working through a field means bouncing
 * category → question → category → question, and each pass can leave another
 * screen on the stack; after a few rounds the user has to press back many times
 * to get out. Resetting states the destination outright, so the trail is the
 * same no matter how deep they were or how they arrived.
 */
/**
 * Land on the Assessment tab with nothing stacked on top of it. Used after a
 * submit: the field is finished, so every screen from that run — summary,
 * categories, questions, review — should be gone, not sitting behind a back
 * gesture.
 */
export const resetToAssessmentTab = (
  navigation: NavigationProp<AppStackParamList>,
): void => {
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
  navigation: NavigationProp<AppStackParamList>,
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
