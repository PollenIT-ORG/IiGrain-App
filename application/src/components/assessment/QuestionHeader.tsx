import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppIcon, ICONS } from '../AppIcon';
import { COLORS, borderRadius, presets, spacing } from '../../constants';
import { addAlpha, moderateScale } from '../../utils';
import AppText from '../AppText/AppText';

export interface QuestionHeaderProps {
  categoryName: string;
  index: number;
  total: number;
  code: string;
  title: string;
  description: string;
}

const QuestionHeader: React.FC<QuestionHeaderProps> = ({
  categoryName,
  index,
  total,
  code,
  title,
  description,
}) => (
  <View style={styles.wrap}>
    <View style={styles.topRow}>
      <View style={styles.badge}>
        <AppIcon name={ICONS.REGEN} size={moderateScale(13)} color={COLORS.primary} />
        <AppText style={styles.badgeText} color={COLORS.primary} numberOfLines={1}>
          {categoryName}
        </AppText>
      </View>
      <AppText style={styles.progress} color={COLORS.gray600}>
        {index} of {total}
      </AppText>
    </View>

    <AppText style={styles.title} color={COLORS.gray900}>
      {code}. {title}
    </AppText>
    <AppText style={styles.description} color={COLORS.gray600}>
      {description}
    </AppText>
  </View>
);

export default React.memo(QuestionHeader);

const styles = StyleSheet.create({
  wrap: {
    gap: spacing[2],
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[2],
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1.5],
    paddingHorizontal: spacing[2.5],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.full,
    backgroundColor: addAlpha(COLORS.primary, 0.1),
    flexShrink: 1,
  },
  badgeText: {
    ...presets.labelSM,
    letterSpacing: 0,
  },
  progress: {
    ...presets.bodySM,
    flexShrink: 0,
  },
  title: {
    ...presets.headingMD,
    marginTop: spacing[1],
  },
  description: {
    ...presets.bodySM,
  },
});
