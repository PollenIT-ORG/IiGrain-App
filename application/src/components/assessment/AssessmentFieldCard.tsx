import React, { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppIcon, ICONS } from '../AppIcon';
import {
  COLORS,
  borderRadius,
  borderWidth,
  presets,
  shadows,
  spacing,
} from '../../constants';
import { formatDate, moderateScale, scale } from '../../utils';
import AppText from '../AppText/AppText';
import AssessmentProgressMeter from './AssessmentProgressMeter';
import AssessmentStatusBadge from './AssessmentStatusBadge';
import type { MyAssessmentField } from '../../types/assessment';

export interface AssessmentFieldCardProps {
  item: MyAssessmentField;
  onPress: (item: MyAssessmentField) => void;
}

const AssessmentFieldCard: React.FC<AssessmentFieldCardProps> = ({ item, onPress }) => {
  const handlePress = useCallback(() => onPress(item), [onPress, item]);

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`${item.fieldName} assessment`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.topRow}>
        <View style={styles.iconCircle}>
          <AppIcon name={ICONS.FIELD} size={moderateScale(20)} color={COLORS.primary} />
        </View>
        <View style={styles.identity}>
          <AppText style={styles.name} numberOfLines={1}>
            {item.fieldName}
          </AppText>
          <AppText style={styles.sub} numberOfLines={1}>
            {item.farmName}
            {item.crop ? ` · ${item.crop}` : ''}
          </AppText>
        </View>
        <AssessmentStatusBadge status={item.status} />
      </View>

      {item.programName ? (
        <View style={styles.programChip}>
          <AppIcon name="clipboard-list-outline" size={moderateScale(13)} color={COLORS.primary} />
          <AppText style={styles.programText} numberOfLines={1}>
            {item.programName}
          </AppText>
        </View>
      ) : null}

      <View style={styles.progressRow}>
        <AssessmentProgressMeter
          progress={item.percentage}
          isComplete={item.status === 'COMPLETED'}
        />
      </View>

      <View style={styles.footerRow}>
        <AppText style={styles.meta}>
          {item.answered}/{item.totalQuestions} answered
        </AppText>
        {item.submittedAtISO ? (
          <View style={styles.submittedRow}>
            <AppIcon name={ICONS.LOCK_CHECK} size={moderateScale(13)} color={COLORS.primary} />
            <AppText style={styles.submitted}>Submitted {formatDate(item.submittedAtISO)}</AppText>
          </View>
        ) : (
          <AppIcon name={ICONS.CHEVRON_RIGHT} size={moderateScale(20)} color={COLORS.gray500} />
        )}
      </View>
    </Pressable>
  );
};

export default React.memo(AssessmentFieldCard);

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: borderRadius.xl,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray200,
    padding: spacing[4],
    gap: spacing[3],
    ...shadows.sm,
  },
  pressed: {
    opacity: 0.9,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  iconCircle: {
    width: scale(40),
    height: scale(40),
    borderRadius: borderRadius.md,
    backgroundColor: COLORS.lightPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identity: {
    flex: 1,
    gap: spacing[0.5],
  },
  name: {
    ...presets.headingXS,
    color: COLORS.gray900,
  },
  sub: {
    ...presets.bodyXS,
    color: COLORS.gray700,
  },
  programChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing[1],
    marginTop: -spacing[1],
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[0.5],
    borderRadius: borderRadius.full,
    backgroundColor: COLORS.lightPrimary,
  },
  programText: {
    ...presets.caption,
    color: COLORS.primaryDark,
    maxWidth: scale(200),
  },
  progressRow: {
    marginTop: -spacing[1],
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[2],
  },
  meta: {
    ...presets.bodyXS,
    color: COLORS.gray700,
  },
  submittedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  submitted: {
    ...presets.caption,
    color: COLORS.primary,
  },
});
