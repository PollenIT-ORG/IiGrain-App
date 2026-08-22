import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import {
  COLORS,
  borderRadius,
  borderWidth,
  fonts,
  presets,
  shadows,
  spacing,
} from '../../constants';
import { moderateScale, scale } from '../../utils';
import { AppIcon, ICONS } from '../AppIcon';
import AppText from '../AppText/AppText';
import RegenScoreRing from '../home/RegenScoreRing';

export interface ReportHeroStat {
  label: string;
  value: string;
}

export interface ReportHeroCardProps {
  year: number;
  score: number | null;
  statusLabel: string;
  delta: number | null;
  asOfLabel?: string;
  stats: ReportHeroStat[];
}

const RING_SIZE = scale(132);
const COUNT_UP_DURATION = 1100;

const useCountUp = (value: number, duration: number): number => {
  const anim = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const id = anim.addListener(({ value: v }) => setDisplay(Math.round(v)));
    anim.setValue(0);
    const animation = Animated.timing(anim, {
      toValue: value,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    animation.start();
    return () => {
      animation.stop();
      anim.removeListener(id);
    };
  }, [anim, value, duration]);

  return display;
};

const ReportHeroCard: React.FC<ReportHeroCardProps> = ({
  year,
  score,
  statusLabel,
  delta,
  asOfLabel,
  stats,
}) => {
  const safeScore = score ?? 0;
  const counted = useCountUp(safeScore, COUNT_UP_DURATION);
  const positive = (delta ?? 0) >= 0;

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.headTexts}>
          <AppText style={styles.eyebrow}>Regen Health Index</AppText>
          <AppText style={styles.year}>{year}</AppText>
          <AppText style={styles.status} numberOfLines={2}>
            {statusLabel}
          </AppText>

          {asOfLabel ? <AppText style={styles.asOf}>{asOfLabel}</AppText> : null}

          {delta === null ? (
            <View style={[styles.pill, styles.pillNeutral]}>
              <AppText style={[styles.pillText, styles.pillTextNeutral]}>
                No comparison yet
              </AppText>
            </View>
          ) : (
            <View style={[styles.pill, positive ? styles.pillUp : styles.pillDown]}>
              <AppIcon
                name={positive ? ICONS.TREND_UP : ICONS.TREND_DOWN}
                size={moderateScale(14)}
                color={positive ? COLORS.primary : COLORS.danger}
              />
              <AppText
                style={[
                  styles.pillText,
                  { color: positive ? COLORS.primary : COLORS.danger },
                ]}>
                {positive ? '+' : '−'}
                {Math.abs(delta)} vs {year - 1}
              </AppText>
            </View>
          )}
        </View>

        <RegenScoreRing
          value={safeScore}
          size={RING_SIZE}
          strokeWidth={scale(11)}
          color={COLORS.primary}
          trackColor={COLORS.lightPrimary}
          duration={COUNT_UP_DURATION}>
          <AppText style={styles.ringValue}>{score === null ? '—' : counted}</AppText>
          <AppText style={styles.ringUnit}>out of 100</AppText>
        </RegenScoreRing>
      </View>

      {stats.length > 0 ? (
        <View style={styles.stats}>
          {stats.map(s => (
            <View key={s.label} style={styles.stat}>
              <AppText style={styles.statValue} numberOfLines={1}>
                {s.value}
              </AppText>
              <AppText style={styles.statLabel} numberOfLines={2}>
                {s.label}
              </AppText>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
};

export default React.memo(ReportHeroCard);

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: borderRadius.xl,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray200,
    padding: spacing[4],
    ...shadows.sm,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  headTexts: {
    flex: 1,
  },
  eyebrow: {
    ...presets.caption,
    color: COLORS.gray600,
  },
  year: {
    ...presets.headingLG,
    color: COLORS.gray900,
    marginTop: spacing[0.5],
  },
  status: {
    ...presets.bodySM,
    color: COLORS.gray700,
    marginTop: spacing[1],
  },
  asOf: {
    ...presets.caption,
    color: COLORS.gray600,
    marginTop: spacing[1],
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing[1],
    paddingHorizontal: spacing[2.5],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.full,
    marginTop: spacing[2.5],
  },
  pillUp: {
    backgroundColor: COLORS.lightPrimary,
  },
  pillDown: {
    backgroundColor: 'rgba(229, 72, 77, 0.12)',
  },
  pillNeutral: {
    backgroundColor: COLORS.gray100,
  },
  pillText: {
    ...presets.caption,
    fontFamily: fonts.semibold,
  },
  pillTextNeutral: {
    color: COLORS.gray600,
  },
  ringValue: {
    ...presets.headingXL,
    color: COLORS.gray900,
  },
  ringUnit: {
    ...presets.caption,
    color: COLORS.gray600,
    marginTop: -spacing[1],
  },
  stats: {
    flexDirection: 'row',
    gap: spacing[2],
    marginTop: spacing[4],
    paddingTop: spacing[4],
    borderTopWidth: borderWidth.thin,
    borderTopColor: COLORS.gray200,
  },
  stat: {
    flex: 1,
  },
  statValue: {
    ...presets.headingSM,
    fontFamily: fonts.semibold,
    color: COLORS.gray900,
  },
  statLabel: {
    ...presets.caption,
    color: COLORS.gray600,
    marginTop: spacing[0.5],
  },
});
