import React from 'react';
import FieldSummaryView from './shared/FieldSummaryView';
import type { FlowNavigation } from './shared/flowTypes';
import type { AppScreenProps } from '../../navigation/navigationTypes';

const AssessmentFieldSummaryScreen: React.FC<
  AppScreenProps<'AssessmentFieldSummary'>
> = ({ route, navigation }) => (
  <FieldSummaryView
    role="farmer"
    params={route.params}
    navigation={navigation as unknown as FlowNavigation}
  />
);

export default AssessmentFieldSummaryScreen;
