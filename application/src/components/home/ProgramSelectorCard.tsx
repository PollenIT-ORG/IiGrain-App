import React, { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppIcon, ICONS } from '../AppIcon';
import AppText from '../AppText/AppText';
import AppStatusBadge from '../AppStatusBadge/AppStatusBadge';
import type { BadgeTone } from '../../types/farm';
import { COLORS } from '../../constants';
import { moderateScale } from '../../utils';
import type { ProgramStatus } from '../../types/dashboard';
import { styles } from './SelectorCardStyle';

export interface ProgramSelectorCardProps {
  programName: string;
  status?: ProgramStatus;
  fieldsEnrolled?: number;
  assessmentsCompleted?: number;
  assessmentsPending?: number;
  programCount: number;
  loading?: boolean;
  onPress: () => void;
}

const STATUS_BADGE: Record<ProgramStatus, { label: string; tone: BadgeTone }> = {
  active: { label: 'Active', tone: 'success' },
  scheduled: { label: 'Scheduled', tone: 'info' },
  ended: { label: 'Ended', tone: 'neutral' },
  inactive: { label: 'Inactive', tone: 'neutral' },
};

const ProgramSelectorCard: React.FC<ProgramSelectorCardProps> = ({
  programName,
  status,
  fieldsEnrolled,
  assessmentsCompleted,
  assessmentsPending,
  programCount,
  loading = false,
  onPress,
}) => {
  const switchable = programCount > 1 && !loading;

  const meta = loading
    ? 'Loading your programs…'
    : [
        fieldsEnrolled !== undefined
          ? `${fieldsEnrolled} ${fieldsEnrolled === 1 ? 'field' : 'fields'}`
          : null,
        assessmentsCompleted !== undefined && assessmentsPending !== undefined
          ? `${assessmentsCompleted} done · ${assessmentsPending} pending`
          : null,
        switchable ? `Tap to switch · ${programCount} programs` : 'Your only program',
      ]
        .filter(Boolean)
        .join(' · ');

  const badge = status ? STATUS_BADGE[status] : null;

  return (
    <Pressable
      onPress={onPress}
      disabled={!switchable}
      accessibilityRole="button"
      accessibilityLabel={
        switchable
          ? `Viewing ${programName}. Tap to switch program.`
          : `Viewing ${programName}`
      }
      accessibilityState={{ disabled: !switchable }}
      style={({ pressed }) => [styles.card, pressed && switchable && styles.pressed]}>
      <View style={styles.iconTile}>
        <AppIcon name={ICONS.PROGRAM} size={moderateScale(22)} color={COLORS.primary} />
      </View>

      <View style={styles.texts}>
        <View style={localStyles.overlineRow}>
          <AppText style={styles.overline}>VIEWING PROGRAM</AppText>
          {badge ? <AppStatusBadge label={badge.label} tone={badge.tone} size="sm" /> : null}
        </View>
        <AppText style={styles.name} numberOfLines={1}>
          {programName}
        </AppText>
        <AppText style={styles.meta} numberOfLines={1}>
          {meta}
        </AppText>
      </View>

      {switchable ? (
        <View style={styles.chevron}>
          <AppIcon name={ICONS.CHEVRON_DOWN} size={moderateScale(18)} color={COLORS.primary} />
        </View>
      ) : null}
    </Pressable>
  );
};

export default memo(ProgramSelectorCard);

const localStyles = StyleSheet.create({
  overlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
