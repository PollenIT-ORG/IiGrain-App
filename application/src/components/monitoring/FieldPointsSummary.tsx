import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { AppIcon, ICONS } from '../AppIcon';
import AppText from '../AppText/AppText';
import {
  COLORS,
  borderRadius,
  borderWidth,
  presets,
  shadows,
  spacing,
} from '../../constants';
import { addAlpha, moderateScale, scale } from '../../utils';
import { BoundaryPreviewMap } from '../../maps/boundary';
import type { LatLng } from '../../maps/types';

export interface FieldPointsSummaryProps {
  ring: readonly LatLng[] | null;
  center: LatLng | null;
  count: number;
  loading?: boolean;
  error?: string | null;
}

const FieldPointsSummary: React.FC<FieldPointsSummaryProps> = ({
  ring,
  center,
  count,
  loading = false,
  error,
}) => {
  const known = count > 0;
  const drawn = !!ring && ring.length >= 3 && !!center;

  return (
    <View style={styles.group}>
      <View style={[styles.card, !!error && styles.cardError]}>
        {drawn ? (
          <View style={styles.preview} pointerEvents="none">
            <BoundaryPreviewMap ring={ring!} center={center!} />
          </View>
        ) : (
          <View style={styles.empty}>
            {loading ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <AppIcon
                name="vector-polygon"
                size={moderateScale(28)}
                color={COLORS.primary}
              />
            )}
            <AppText style={styles.emptyText}>
              {loading
                ? 'Reading this field’s outline…'
                : 'This field has not been drawn yet'}
            </AppText>
          </View>
        )}

        <View style={styles.row}>
          <View style={styles.icon}>
            <AppIcon
              name={known ? 'vector-square' : 'vector-polygon'}
              size={moderateScale(18)}
              color={known ? COLORS.primary : COLORS.gray600}
            />
          </View>

          <View style={styles.texts}>
            <AppText style={styles.title}>
              {loading && !known
                ? 'Reading this field’s points…'
                : known
                ? `This field has ${count} point${count === 1 ? '' : 's'}`
                : 'This field has no points yet'}
            </AppText>
            <AppText style={styles.subtitle}>
              {known
                ? 'All of them are saved with their latitude and longitude when you save this record.'
                : 'Draw this field’s boundary from its Overview tab and its points will be saved here.'}
            </AppText>
          </View>
        </View>
      </View>

      {error ? (
        <View style={styles.errorRow}>
          <AppIcon name={ICONS.ERROR} size={moderateScale(14)} color={COLORS.danger} />
          <AppText style={styles.errorText}>{error}</AppText>
        </View>
      ) : null}
    </View>
  );
};

export default React.memo(FieldPointsSummary);

const styles = StyleSheet.create({
  group: {
    width: '100%',
    marginBottom: spacing[4],
  },
  card: {
    borderRadius: borderRadius.xl,
    borderWidth: borderWidth.thin,
    borderColor: addAlpha(COLORS.primary, 0.2),
    backgroundColor: COLORS.lightPrimaryBg,
    overflow: 'hidden',
    ...shadows.xs,
  },
  cardError: {
    borderColor: addAlpha(COLORS.danger, 0.35),
  },

  preview: {
    height: scale(150),
    backgroundColor: COLORS.primaryDark,
  },
  empty: {
    height: scale(110),
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[6],
    backgroundColor: addAlpha(COLORS.primary, 0.06),
  },
  emptyText: {
    ...presets.bodyXS,
    color: COLORS.gray700,
    textAlign: 'center',
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    borderTopWidth: borderWidth.hairline,
    borderTopColor: addAlpha(COLORS.primary, 0.18),
  },
  icon: {
    width: scale(34),
    height: scale(34),
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
  },
  texts: {
    flex: 1,
    gap: scale(2),
  },
  title: {
    ...presets.labelMD,
    color: COLORS.gray900,
  },
  subtitle: {
    ...presets.bodyXS,
    color: COLORS.gray700,
  },

  errorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2],
    marginTop: spacing[1],
  },
  errorText: {
    ...presets.bodyXS,
    color: COLORS.danger,
    flex: 1,
  },
});
