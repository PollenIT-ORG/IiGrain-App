import React from 'react';
import {
  Pressable,
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
import { moderateScale, scale } from '../../../utils';

export interface NudgePadProps {
  pointNumber: number;
  onNudge: (north: number, east: number) => void;
  style?: StyleProp<ViewStyle>;
}

const Arrow: React.FC<{
  icon: string;
  label: string;
  onPress: () => void;
}> = ({ icon, label, onPress }) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={label}
    hitSlop={6}
    style={({ pressed }) => [styles.arrow, pressed && styles.arrowPressed]}>
    <AppIcon name={icon} size={moderateScale(18)} color={COLORS.infoBlue} />
  </Pressable>
);

const NudgePad: React.FC<NudgePadProps> = ({ pointNumber, onNudge, style }) => (
  <View style={[styles.pad, style]}>
    <AppText style={styles.title}>{`Point ${pointNumber}`}</AppText>
    <View style={styles.row}>
      <View style={styles.spacer} />
      <Arrow icon="chevron-up" label="Nudge point north" onPress={() => onNudge(1, 0)} />
      <View style={styles.spacer} />
    </View>
    <View style={styles.row}>
      <Arrow icon="chevron-left" label="Nudge point west" onPress={() => onNudge(0, -1)} />
      <View style={styles.centre}>
        <View style={styles.centreDot} />
      </View>
      <Arrow icon="chevron-right" label="Nudge point east" onPress={() => onNudge(0, 1)} />
    </View>
    <View style={styles.row}>
      <View style={styles.spacer} />
      <Arrow icon="chevron-down" label="Nudge point south" onPress={() => onNudge(-1, 0)} />
      <View style={styles.spacer} />
    </View>
  </View>
);

export default React.memo(NudgePad);

const CELL = scale(34);

const styles = StyleSheet.create({
  pad: {
    position: 'absolute',
    alignItems: 'center',
    padding: spacing[2],
    borderRadius: borderRadius.lg,
    backgroundColor: COLORS.white,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray200,
    ...shadows.lg,
  },
  title: {
    ...presets.caption,
    fontFamily: fonts.semibold,
    color: COLORS.infoBlue,
    paddingBottom: spacing[1],
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  spacer: { width: CELL, height: CELL },
  arrow: {
    width: CELL,
    height: CELL,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.md,
  },
  arrowPressed: { backgroundColor: COLORS.lightPrimary },
  centre: { width: CELL, height: CELL, alignItems: 'center', justifyContent: 'center' },
  centreDot: {
    width: scale(8),
    height: scale(8),
    borderRadius: scale(4),
    backgroundColor: COLORS.infoBlue,
  },
});
