import React from 'react';
import FieldSummaryView from '../assessment/shared/FieldSummaryView';
import type { FlowNavigation } from '../assessment/shared/flowTypes';
import type { AssessorScreenProps } from '../../navigation/navigationTypes';

const AssessorAssessmentSummaryScreen: React.FC<
  AssessorScreenProps<'AssessorAssessmentSummary'>
> = ({ route, navigation }) => (
  <FieldSummaryView
    role="assessor"
    params={route.params}
    navigation={navigation as unknown as FlowNavigation}
  />
);

export default AssessorAssessmentSummaryScreen;
