import React from 'react';
import ReviewView from './shared/ReviewView';
import type { FlowNavigation } from './shared/flowTypes';
import type { AppScreenProps } from '../../navigation/navigationTypes';

const AssessmentReviewScreen: React.FC<AppScreenProps<'AssessmentReview'>> = ({
  route,
  navigation,
}) => (
  <ReviewView
    role="farmer"
    params={route.params}
    navigation={navigation as unknown as FlowNavigation}
  />
);

export default AssessmentReviewScreen;
