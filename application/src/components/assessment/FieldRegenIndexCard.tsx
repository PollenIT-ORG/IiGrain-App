import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppIcon, ICONS } from '../AppIcon';
import AppText from '../AppText/AppText';
import RegenHealthCard from '../home/RegenHealthCard';
import { AppShimmer, AppShimmerText } from '../Shimmer';
import {
  COLORS,
  borderRadius,
  borderWidth,
  presets,
  shadows,
  spacing,
} from '../../constants';
import { progressColorForPercent } from '../../constants/gradients';
import { moderateScale, scale } from '../../utils';
import type { FieldRegenIndex } from '../../types/assessment';

interface FieldRegenIndexCardProps {
  data: FieldRegenIndex | null;
  loading: boolean;
}

const FieldRegenIndexCard: React.FC<FieldRegenIndexCardProps> = ({ data, loading }) => {
  const metrics = useMemo(
    () =>
      (data?.categories ?? []).map(c => ({
        label: c.name,
        value: c.score ?? 0,
        color: c.score === null ? COLORS.gray300 : progressColorForPercent(c.score),
        valueLabel: c.score === null ? '—' : undefined,
        dimmed: c.score === null,
      })),
    [data],
  );

  if (loading && !data) {
    return (
      <View style={styles.card}>
        <AppShimmerText width="55%" height={moderateScale(16)} />
        <AppShimmer
          width="100%"
          height={scale(96)}
          radius={borderRadius.lg}
          style={styles.shimmerGap}
        />
      </View>
    );
  }

  if (!data || data.regenHealthIndex === null) {
    return (
      <View style={styles.card}>
        <AppText style={styles.title}>Regen Health Index</AppText>
        <View style={styles.emptyRow}>
          <View style={styles.emptyIcon}>
            <AppIcon name={ICONS.REGEN} size={moderateScale(22)} color={COLORS.gray500} />
          </View>
          <AppText style={styles.emptyText}>
            Start this assessment to see your Regen Health Index.
          </AppText>
        </View>
      </View>
    );
  }

  return (
    <RegenHealthCard
      score={data.regenHealthIndex}
      status={data.rating ?? ''}
      metrics={metrics}
    />
  );
};

export default React.memo(FieldRegenIndexCard);

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: borderRadius['2xl'],
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray200,
    padding: spacing[4],
    ...shadows.md,
  },
  title: { ...presets.headingSM, color: COLORS.gray900 },
  shimmerGap: { marginTop: spacing[3] },
  emptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    marginTop: spacing[3],
  },
  emptyIcon: {
    width: scale(44),
    height: scale(44),
    borderRadius: borderRadius.full,
    backgroundColor: COLORS.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    ...presets.bodySM,
    color: COLORS.gray600,
    flex: 1,
  },
});
