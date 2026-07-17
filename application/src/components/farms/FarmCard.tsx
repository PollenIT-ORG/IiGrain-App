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
import { addAlpha, formatDate, formatNumber, moderateScale, scale } from '../../utils';
import AppText from '../AppText/AppText';
import StatusBadge from './StatusBadge';
import { FARM_STATUS_META, type Farm } from '../../types/farm';

export interface FarmCardProps {
  farm: Farm;
  onPress: (farmId: string) => void;
  fieldCount?: number;
}

export const FARM_CARD_HEIGHT = scale(150);
const FARM_CARD_GAP = spacing[3];
export const FARM_CARD_TOTAL_HEIGHT = FARM_CARD_HEIGHT + FARM_CARD_GAP;

const RIPPLE = { color: addAlpha(COLORS.primary, 0.08) };
const CHEVRON_SIZE = moderateScale(20);
const META_ICON = moderateScale(15);
const CHIP_ICON = moderateScale(13);

const FarmCard: React.FC<FarmCardProps> = ({ farm, onPress, fieldCount }) => {
  const handlePress = useCallback(() => onPress(farm.id), [onPress, farm.id]);
  const statusMeta = FARM_STATUS_META[farm.status];
  const resolvedCount = fieldCount ?? (farm.fieldsCount || undefined);
  const fieldsLabel = resolvedCount === undefined ? '-' : `${resolvedCount}`;

  return (
    <Pressable
      onPress={handlePress}
      android_ripple={RIPPLE}
      accessibilityRole="button"
      accessibilityLabel={`${farm.name}, ${farm.location}`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.topRow}>
        <View style={styles.iconTile}>
          <AppIcon name={ICONS.FARM} size={moderateScale(24)} color={COLORS.primary} />
        </View>

        <View style={styles.identity}>
          <AppText style={styles.name} numberOfLines={1}>
            {farm.name}
          </AppText>
          <View style={styles.locationRow}>
            <AppIcon name={ICONS.LOCATION} size={META_ICON} color={COLORS.gray500} />
            <AppText style={styles.location} numberOfLines={1}>
              {farm.location}
            </AppText>
          </View>
        </View>

        <StatusBadge label={statusMeta.label} tone={statusMeta.tone} />
      </View>

      <View style={styles.chipRow}>
        <View style={styles.chip}>
          <AppIcon name={ICONS.GRID} size={CHIP_ICON} color={COLORS.primary} />
          <AppText style={styles.chipText}>{fieldsLabel} Fields</AppText>
        </View>
        <View style={styles.chip}>
          <AppIcon name={ICONS.AREA} size={CHIP_ICON} color={COLORS.primary} />
          <AppText style={styles.chipText}>{formatNumber(farm.areaAcres)} acres</AppText>
        </View>
      </View>

      <View style={styles.footerRow}>
        <View style={styles.updatedGroup}>
          <AppIcon name={ICONS.CLOCK} size={META_ICON} color={COLORS.gray500} />
          <AppText style={styles.updated}>Updated {formatDate(farm.lastUpdatedISO)}</AppText>
        </View>
        <AppIcon name={ICONS.CHEVRON_RIGHT} size={CHEVRON_SIZE} color={COLORS.gray500} />
      </View>
    </Pressable>
  );
};

export default React.memo(FarmCard);

const styles = StyleSheet.create({
  card: {
    height: FARM_CARD_HEIGHT,
    marginBottom: FARM_CARD_GAP,
    backgroundColor: COLORS.white,
    borderRadius: borderRadius.xl,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray200,
    padding: spacing[4],
    justifyContent: 'space-between',
    overflow: 'hidden',
    ...shadows.md,
  },
  pressed: {
    opacity: 0.96,
    transform: [{ scale: 0.992 }],
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  iconTile: {
    width: scale(46),
    height: scale(46),
    borderRadius: borderRadius.lg,
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
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  location: {
    ...presets.bodyXS,
    color: COLORS.gray600,
    flexShrink: 1,
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    backgroundColor: COLORS.gray100,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing[2.5],
    paddingVertical: spacing[1],
  },
  chipText: {
    ...presets.labelSM,
    color: COLORS.gray700,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  updatedGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  updated: {
    ...presets.caption,
    color: COLORS.gray500,
  },
});
