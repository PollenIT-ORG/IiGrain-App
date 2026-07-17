import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { COLORS } from '../../constants';
import type { AssessmentCategory } from '../../types/assessment';
import CategoryProgressItem from './CategoryProgressItem';

export interface CategoryProgressListProps {
  categories: AssessmentCategory[];
  onCategoryPress?: (category: AssessmentCategory) => void;
}

const CategoryProgressList: React.FC<CategoryProgressListProps> = ({
  categories,
  onCategoryPress,
}) => (
  <View>
    {categories.map((cat, index) => (
      <View key={cat.id}>
        <CategoryProgressItem category={cat} onPress={onCategoryPress} />
        {index < categories.length - 1 ? <View style={styles.divider} /> : null}
      </View>
    ))}
  </View>
);

export default memo(CategoryProgressList);

const styles = StyleSheet.create({
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.gray300,
  },
});
