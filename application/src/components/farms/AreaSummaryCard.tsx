import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
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
import { formatAcres } from '../../maps/utils/fieldAcres';
import AppText from '../AppText/AppText';
import AppGradient from '../AppGradient/AppGradient';

export interface AreaSummaryCardProps {
  total: number;
  used: number;
  available: number;
}

const LR_START = { x: 0, y: 0 };
const LR_END = { x: 1, y: 0 };
const PROGRESS_MS = 900;

const formatPercent = (value: number): string => {
  if (value === 0 || Number.isInteger(value)) {
    return `${value}`;
  }
  return value < 1 ? value.toFixed(1) : `${Math.round(value)}`;
};

interface LegendStatProps {
  label: string;
  value: number;
  color: string;
}

const LegendStat: React.FC<LegendStatProps> = ({ label, value, color }) => (
  <View style={styles.stat} accessible accessibilityLabel={`${label}: ${value} acres`}>
    <View style={styles.statTop}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <AppText
        style={styles.statValue}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}>
        {formatAcres(value)}
      </AppText>
    </View>
    <AppText style={styles.statLabel} numberOfLines={2}>
      {label}
    </AppText>
  </View>
);

const MemoLegendStat = React.memo(LegendStat);

const AreaSummaryCard: React.FC<AreaSummaryCardProps> = ({ total, used, available }) => {
  const percentage = useMemo(() => {
    if (total <= 0) {
      return 0;
    }
    return Math.min(100, Math.max(0, (used / total) * 100));
  }, [total, used]);

  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: percentage,
      duration: PROGRESS_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [anim, percentage]);

  const width = anim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  const hasArea = total > 0;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.iconWrap}>
          <AppIcon name="vector-square" size={moderateScale(18)} color={COLORS.primary} />
        </View>
        <AppText style={styles.title}>Land Enrolled</AppText>
        {hasArea ? (
          <AppText style={styles.pct}>{formatPercent(percentage)}%</AppText>
        ) : null}
      </View>

      {hasArea ? (
        <>
          <View
            style={styles.track}
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: 100, now: Math.round(percentage) }}>
            <Animated.View style={[styles.fillWrap, { width }]}>
              <AppGradient
                variant="progress"
                start={LR_START}
                end={LR_END}
                style={StyleSheet.absoluteFillObject}
              />
            </Animated.View>
          </View>

          <AppText style={styles.caption}>
            {formatAcres(used)} of {formatAcres(total)} acres reported
          </AppText>

          <View style={styles.legendRow}>
            <MemoLegendStat label="Total area" value={total} color={COLORS.gray500} />
            <MemoLegendStat label="Reported area" value={used} color={COLORS.primary} />
            <MemoLegendStat label="Remaining area" value={available} color={COLORS.success} />
          </View>
        </>
      ) : (
        <View style={styles.empty}>
          <AppIcon name="vector-square" size={moderateScale(28)} color={COLORS.gray300} />
          <AppText style={styles.emptyText}>
            No area recorded yet. Add fields to track how much land is enrolled.
          </AppText>
        </View>
      )}
    </View>
  );
};

export default React.memo(AreaSummaryCard);

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray200,
    borderRadius: borderRadius['2xl'],
    padding: spacing[5],
    gap: spacing[2.5],
    ...shadows.sm,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2.5] },
  iconWrap: {
    width: scale(36),
    height: scale(36),
    borderRadius: borderRadius.lg,
    backgroundColor: COLORS.lightPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...presets.labelLG, color: COLORS.gray900, flex: 1 },
  pct: { ...presets.headingSM, color: COLORS.primary },
  track: {
    height: scale(10),
    borderRadius: borderRadius.full,
    backgroundColor: COLORS.gray200,
    overflow: 'hidden',
    marginTop: spacing[1],
  },
  fillWrap: { height: '100%', borderRadius: borderRadius.full, overflow: 'hidden' },
  caption: { ...presets.bodyXS, color: COLORS.gray600 },
  legendRow: {
    flexDirection: 'row',
    marginTop: spacing[2],
    paddingTop: spacing[3.5],
    borderTopWidth: borderWidth.thin,
    borderTopColor: COLORS.gray200,
    gap: spacing[3],
  },
  stat: { flex: 1, gap: spacing[1.5] },
  statTop: { flexDirection: 'row', alignItems: 'center', gap: spacing[1.5] },
  dot: { width: scale(8), height: scale(8), borderRadius: borderRadius.full },
  statValue: { ...presets.labelMD, color: COLORS.gray900, flexShrink: 1 },
  statLabel: { ...presets.bodyXS, color: COLORS.gray600 },
  empty: {
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: spacing[4],
  },
  emptyText: {
    ...presets.bodyXS,
    color: COLORS.gray600,
    textAlign: 'center',
  },
});
