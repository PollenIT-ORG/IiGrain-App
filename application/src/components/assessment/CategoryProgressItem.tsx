import React, { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppIcon, ICONS } from '../AppIcon';
import { COLORS, borderRadius, presets, spacing } from '../../constants';
import { moderateScale, scale } from '../../utils';
import AppText from '../AppText/AppText';
import type { AssessmentCategory } from '../../types/assessment';

export interface CategoryProgressItemProps {
  category: AssessmentCategory;
  onPress?: (category: AssessmentCategory) => void;
  locked?: boolean;
}

const CategoryProgressItem: React.FC<CategoryProgressItemProps> = ({
  category,
  onPress,
  locked = false,
}) => {
  const handlePress = useCallback(() => onPress?.(category), [onPress, category]);

  const content = (
    <>
      <View style={[styles.iconWrap, locked && styles.iconWrapLocked]}>
        <AppIcon
          name={locked ? ICONS.LOCK : category.icon}
          size={moderateScale(16)}
          color={locked ? COLORS.gray500 : COLORS.primary}
        />
      </View>

      <AppText style={styles.title} numberOfLines={1}>
        {category.title}
      </AppText>

      <View style={styles.rightGroup}>
        <AppText style={styles.fraction}>
          {category.completed} / {category.total}
        </AppText>
        <AppText style={styles.percent} color={category.color}>
          {category.percentage}%
        </AppText>
        {onPress ? (
          <AppIcon
            name={locked ? ICONS.LOCK : ICONS.CHEVRON_RIGHT}
            size={moderateScale(18)}
            color={COLORS.gray500}
          />
        ) : null}
      </View>
    </>
  );

  const accessibilityLabel = `${category.title}: ${category.completed} of ${
    category.total
  } completed, ${category.percentage} percent${
    locked ? ', locked until you reach the field' : ''
  }`;

  if (onPress) {
    return (
      <Pressable
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
        {content}
      </Pressable>
    );
  }

  return (
    <View style={styles.row} accessibilityLabel={accessibilityLabel}>
      {content}
    </View>
  );
};

export default React.memo(CategoryProgressItem);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[2.5],
  },
  rowPressed: {
    opacity: 0.6,
  },
  iconWrap: {
    width: scale(32),
    height: scale(32),
    borderRadius: borderRadius.full,
    backgroundColor: COLORS.lightPrimaryBg,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconWrapLocked: {
    backgroundColor: COLORS.gray100,
  },
  title: {
    ...presets.bodySM,
    color: COLORS.gray700,
    flex: 1,
  },
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  fraction: {
    ...presets.bodyXS,
    color: COLORS.gray500,
  },
  percent: {
    ...presets.labelMD,
    minWidth: scale(32),
    textAlign: 'right',
  },
});
