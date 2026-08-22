import React from 'react';
import QuestionView from './shared/QuestionView';
import type { FlowNavigation } from './shared/flowTypes';
import type { AppScreenProps } from '../../navigation/navigationTypes';

const AssessmentQuestionDetailScreen: React.FC<
  AppScreenProps<'AssessmentQuestionDetail'>
> = ({ route, navigation }) => (
  <QuestionView
    role="farmer"
    params={route.params}
    navigation={navigation as unknown as FlowNavigation}
  />
);

export default AssessmentQuestionDetailScreen;
