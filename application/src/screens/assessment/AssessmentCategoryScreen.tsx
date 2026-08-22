import React from 'react';
import CategoryView from './shared/CategoryView';
import type { FlowNavigation } from './shared/flowTypes';
import type { AppScreenProps } from '../../navigation/navigationTypes';

const AssessmentCategoryScreen: React.FC<AppScreenProps<'AssessmentCategory'>> = ({
  route,
  navigation,
}) => (
  <CategoryView
    role="farmer"
    params={route.params}
    navigation={navigation as unknown as FlowNavigation}
  />
);

export default AssessmentCategoryScreen;
