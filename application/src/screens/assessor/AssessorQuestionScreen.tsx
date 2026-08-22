import React from 'react';
import QuestionView from '../assessment/shared/QuestionView';
import type { FlowNavigation } from '../assessment/shared/flowTypes';
import type { AssessorScreenProps } from '../../navigation/navigationTypes';

const AssessorQuestionScreen: React.FC<AssessorScreenProps<'AssessorQuestion'>> = ({
  route,
  navigation,
}) => (
  <QuestionView
    role="assessor"
    params={route.params}
    navigation={navigation as unknown as FlowNavigation}
  />
);

export default AssessorQuestionScreen;
