import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { AppIcon, ICONS } from '../AppIcon';
import AppText from '../AppText/AppText';
import RegenScoreRing from './RegenScoreRing';
import MetricBar from './MetricBar';
import { COLORS,
  borderRadius,
  borderWidth,
  presets,
  shadows,
  spacing, fonts } from '../../constants';
import { moderateScale } from '../../utils';

interface Metric {
  label: string;
  value: number;
  color: string;
}

interface RegenHealthCardProps {
  score: number;
  max?: number;
  status: string;
  deltaLabel?: string;
  deltaPositive?: boolean;
  metrics: Metric[];
  onPress?: () => void;
}

const RegenHealthCard: React.FC<RegenHealthCardProps> = ({
  score,
  max = 100,
  status,
  deltaLabel,
  deltaPositive = true,
  metrics,
  onPress,
}) => {
  const deltaColor = deltaPositive ? COLORS.success : COLORS.danger;

  const inner = (
    <>
      <View style={styles.titleRow}>
        <AppText style={styles.title}>Regen Health Index</AppText>
        {onPress ? (
          <View style={styles.hint}>
            <AppText style={styles.hintText}>Reports</AppText>
            <AppIcon name={ICONS.CHEVRON_RIGHT} size={moderateScale(18)} color={COLORS.primary} />
          </View>
        ) : null}
      </View>

      <View style={styles.row}>
        <View style={styles.ringCol}>
          <RegenScoreRing
            value={score}
            max={max}
            color={COLORS.primary}
            trackColor={COLORS.lightPrimary}>
            <View style={styles.scoreCenter}>
              <AppText style={styles.scoreValue}>{score}</AppText>
              <AppText style={styles.scoreMax}>/{max}</AppText>
            </View>
          </RegenScoreRing>

          <AppText style={styles.status}>{status}</AppText>
          {deltaLabel ? (
            <View style={styles.deltaRow}>
              <AppIcon
                name={deltaPositive ? 'arrow-up' : 'arrow-down'}
                size={moderateScale(13)}
                color={deltaColor}
              />
              <AppText style={[styles.delta, { color: deltaColor }]}>{deltaLabel}</AppText>
            </View>
          ) : null}
        </View>

        <View style={styles.metricsCol}>
          {metrics.map((m, i) => (
            <MetricBar
              key={m.label}
              label={m.label}
              value={m.value}
              max={max}
              color={m.color}
              delay={280 + i * 90}
            />
          ))}
        </View>
      </View>
    </>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.85}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="View Regen reports">
        {inner}
      </TouchableOpacity>
    );
  }

  return <View style={styles.card}>{inner}</View>;
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: borderRadius['2xl'],
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray200,
    padding: spacing[4],
    ...shadows.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[3],
  },
  title: { ...presets.headingSM, color: COLORS.gray900 },
  hint: { flexDirection: 'row', alignItems: 'center', gap: spacing[0.5] },
  hintText: { ...presets.labelSM, color: COLORS.primary },
  row: { flexDirection: 'row', alignItems: 'center' },
  ringCol: { alignItems: 'center', width: moderateScale(128) },
  scoreCenter: { alignItems: 'center', justifyContent: 'center' },
  scoreValue: { ...presets.displaySmall, color: COLORS.gray900 },
  scoreMax: { ...presets.caption, color: COLORS.gray500, marginTop: -spacing[0.5] },
  status: { ...presets.bodyXS, color: COLORS.gray600, marginTop: spacing[2] },
  deltaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[0.5], marginTop: spacing[1] },
  delta: { ...presets.caption, fontFamily: fonts.semibold },
  metricsCol: { flex: 1, gap: spacing[2.5], paddingLeft: spacing[4] },
});

export default RegenHealthCard;
