import React from 'react';
import CategoryView from '../assessment/shared/CategoryView';
import type { FlowNavigation } from '../assessment/shared/flowTypes';
import type { AssessorScreenProps } from '../../navigation/navigationTypes';

const AssessorCategoryScreen: React.FC<AssessorScreenProps<'AssessorCategory'>> = ({
  route,
  navigation,
}) => (
  <CategoryView
    role="assessor"
    params={route.params}
    navigation={navigation as unknown as FlowNavigation}
  />
);

export default AssessorCategoryScreen;
