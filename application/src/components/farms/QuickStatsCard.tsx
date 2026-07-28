import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppIcon } from '../AppIcon';
import {
  COLORS,
  borderRadius,
  borderWidth,
  presets,
  shadows,
  spacing,
} from '../../constants';
import { moderateScale, scale } from '../../utils';
import AppText from '../AppText/AppText';

export interface QuickStatsCardProps {
  /** Regenerative score, 0–100. */
  regenScore: number;
  /** Preformatted date string for the last update. */
  lastUpdatedLabel: string;
}

interface StatProps {
  icon: string;
  value: string;
  label: string;
  tint: string;
  tintBg: string;
}

const Stat: React.FC<StatProps> = ({ icon, value, label, tint, tintBg }) => (
  <View style={styles.stat} accessible accessibilityLabel={`${label}: ${value}`}>
    <View style={[styles.iconCircle, { backgroundColor: tintBg }]}>
      <AppIcon name={icon} size={moderateScale(20)} color={tint} />
    </View>
    <AppText style={styles.value} numberOfLines={1} adjustsFontSizeToFit>
      {value}
    </AppText>
    <AppText style={styles.label} numberOfLines={2}>
      {label}
    </AppText>
  </View>
);

/**
 * The two numbers worth surfacing at a glance.
 *
 * Deliberately just two: "Fields" and "Total Area" used to live here as well,
 * but they are attributes of the farm and now appear once, in the summary card.
 * What remains is the health signal and its freshness.
 */
const QuickStatsCard: React.FC<QuickStatsCardProps> = ({
  regenScore,
  lastUpdatedLabel,
}) => (
  <View style={styles.card}>
    <Stat
      icon="leaf"
      value={`${regenScore}`}
      label="Regen Index"
      tint={COLORS.success}
      tintBg={COLORS.lightPrimary}
    />
    <View style={styles.divider} />
    <Stat
      icon="calendar-outline"
      value={lastUpdatedLabel}
      label="Last Updated"
      tint={COLORS.primary}
      tintBg={COLORS.lightPrimaryBg}
    />
  </View>
);

export default React.memo(QuickStatsCard);

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: COLORS.white,
    borderRadius: borderRadius['2xl'],
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray200,
    paddingVertical: spacing[5],
    ...shadows.sm,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[3],
  },
  divider: {
    width: borderWidth.thin,
    backgroundColor: COLORS.gray200,
    // Inset so the rule reads as a separator, not a full-height border.
    marginVertical: spacing[1],
  },
  iconCircle: {
    width: scale(40),
    height: scale(40),
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    ...presets.headingSM,
    color: COLORS.gray900,
    textAlign: 'center',
  },
  label: {
    ...presets.bodyXS,
    color: COLORS.gray600,
    textAlign: 'center',
  },
});
