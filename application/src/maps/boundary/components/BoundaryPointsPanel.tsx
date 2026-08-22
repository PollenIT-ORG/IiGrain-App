import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { AppIcon } from '../../../components/AppIcon';
import AppText from '../../../components/AppText/AppText';
import {
  COLORS,
  borderRadius,
  borderWidth,
  fonts,
  presets,
  shadows,
  spacing,
} from '../../../constants';
import { addAlpha, moderateScale, scale } from '../../../utils';
import type { LatLng } from '../../types';

export interface BoundaryPointsPanelProps {
  ring: readonly LatLng[];
  selected?: number | null;
  onSelectPoint?: (index: number) => void;
  style?: StyleProp<ViewStyle>;
}

const coordText = (point: LatLng): string =>
  `${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}`;

const LIST_MAX_HEIGHT = scale(210);

const BoundaryPointsPanel: React.FC<BoundaryPointsPanelProps> = ({
  ring,
  selected = null,
  onSelectPoint,
  style,
}) => {
  const [open, setOpen] = useState(false);

  if (ring.length === 0) {
    return null;
  }

  return (
    <View style={[styles.wrap, style]}>
      <Pressable
        onPress={() => setOpen(v => !v)}
        style={styles.toggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={
          open ? 'Hide the drawn points' : `Show the ${ring.length} drawn points`
        }>
        <AppIcon name="map-marker-multiple-outline" size={moderateScale(15)} color={COLORS.white} />
        <AppText style={styles.toggleText}>
          {ring.length} point{ring.length === 1 ? '' : 's'}
        </AppText>
        <AppIcon
          name={open ? 'chevron-up' : 'chevron-down'}
          size={moderateScale(15)}
          color={COLORS.white}
        />
      </Pressable>

      {open ? (
        <View style={styles.card}>
          <AppText style={styles.cardTitle}>Drawn points</AppText>
          <ScrollView
            style={styles.list}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled>
            {ring.map((point, index) => {
              const active = selected === index;
              return (
                <Pressable
                  key={`${index}-${point.latitude}-${point.longitude}`}
                  onPress={() => onSelectPoint?.(index)}
                  disabled={!onSelectPoint}
                  accessibilityRole={onSelectPoint ? 'button' : 'text'}
                  accessibilityLabel={`Point ${index + 1}, ${coordText(point)}`}
                  style={({ pressed }) => [
                    styles.row,
                    active && styles.rowActive,
                    pressed && !!onSelectPoint && styles.rowPressed,
                  ]}>
                  <View style={[styles.badge, active && styles.badgeActive]}>
                    <AppText style={styles.badgeText}>{index + 1}</AppText>
                  </View>
                  <AppText style={styles.coord} numberOfLines={1}>
                    {coordText(point)}
                  </AppText>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
};

export default React.memo(BoundaryPointsPanel);

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    alignItems: 'flex-start',
    gap: spacing[2],
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(5),
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.full,
    backgroundColor: addAlpha(COLORS.gray900, 0.62),
  },
  toggleText: {
    ...presets.labelSM,
    fontFamily: fonts.semibold,
    color: COLORS.white,
  },

  card: {
    width: scale(210),
    borderRadius: borderRadius.lg,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray200,
    backgroundColor: COLORS.white,
    paddingVertical: spacing[2],
    ...shadows.md,
  },
  cardTitle: {
    ...presets.caption,
    color: COLORS.gray500,
    paddingHorizontal: spacing[3],
    paddingBottom: spacing[1],
  },
  list: {
    maxHeight: LIST_MAX_HEIGHT,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  rowActive: {
    backgroundColor: COLORS.lightPrimary,
  },
  rowPressed: {
    backgroundColor: COLORS.gray100,
  },
  badge: {
    minWidth: scale(20),
    height: scale(20),
    paddingHorizontal: scale(3),
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.gray600,
  },
  badgeActive: {
    backgroundColor: COLORS.primary,
  },
  badgeText: {
    ...presets.caption,
    fontFamily: fonts.semibold,
    color: COLORS.white,
  },
  coord: {
    ...presets.bodyXS,
    color: COLORS.gray900,
    flex: 1,
  },
});
