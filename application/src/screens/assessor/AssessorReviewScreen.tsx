import React from 'react';
import ReviewView from '../assessment/shared/ReviewView';
import type { FlowNavigation } from '../assessment/shared/flowTypes';
import type { AssessorScreenProps } from '../../navigation/navigationTypes';

const AssessorReviewScreen: React.FC<AssessorScreenProps<'AssessorReview'>> = ({
  route,
  navigation,
}) => (
  <ReviewView
    role="assessor"
    params={route.params}
    navigation={navigation as unknown as FlowNavigation}
  />
);

export default AssessorReviewScreen;
