import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { AppIcon } from '../../../components/AppIcon';
import { COLORS, borderRadius, borderWidth, shadows, spacing } from '../../../constants';
import { moderateScale, scale } from '../../../utils';

export interface MapActionRailProps {
  onFit: () => void;
  onLocate: () => void;
  fitDisabled?: boolean;
  locating?: boolean;
  style?: StyleProp<ViewStyle>;
}

const RailButton: React.FC<{
  icon: string;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
}> = ({ icon, label, onPress, disabled, busy }) => (
  <Pressable
    onPress={onPress}
    disabled={disabled || busy}
    accessibilityRole="button"
    accessibilityLabel={label}
    style={({ pressed }) => [
      styles.button,
      pressed && styles.buttonPressed,
      disabled && styles.buttonDisabled,
    ]}>
    {busy ? (
      <ActivityIndicator size="small" color={COLORS.primary} />
    ) : (
      <AppIcon
        name={icon}
        size={moderateScale(20)}
        color={disabled ? COLORS.gray300 : COLORS.gray900}
      />
    )}
  </Pressable>
);

const MapActionRail: React.FC<MapActionRailProps> = ({
  onFit,
  onLocate,
  fitDisabled,
  locating,
  style,
}) => (
  <View style={[styles.rail, style]}>
    <RailButton
      icon="fit-to-screen-outline"
      label="Fit boundary on screen"
      onPress={onFit}
      disabled={fitDisabled}
    />
    <RailButton
      icon="crosshairs-gps"
      label="Go to my location"
      onPress={onLocate}
      busy={locating}
    />
  </View>
);

export default React.memo(MapActionRail);

const styles = StyleSheet.create({
  rail: {
    position: 'absolute',
    gap: spacing[2],
  },
  button: {
    width: scale(44),
    height: scale(44),
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray200,
    ...shadows.md,
  },
  buttonPressed: { backgroundColor: COLORS.lightPrimary },
  buttonDisabled: { backgroundColor: COLORS.gray100 },
});
