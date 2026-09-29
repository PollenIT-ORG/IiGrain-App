import React from 'react';
import { StyleSheet, View } from 'react-native';
import { COLORS, borderRadius, borderWidth, fonts, presets, spacing } from '../constants';
import { addAlpha, moderateScale, scale } from '../utils';
import { AppIcon, ICONS } from './AppIcon';
import AppText from './AppText/AppText';

export type PendingSyncSize = 'sm' | 'md';

export interface PendingSyncChipProps {
  visible?: boolean;
  label?: string;
  size?: PendingSyncSize;
  style?: View['props']['style'];
}

const PendingSyncChip: React.FC<PendingSyncChipProps> = ({
  visible = true,
  label = 'Waiting to sync',
  size = 'md',
  style,
}) => {
  if (!visible) {
    return null;
  }

  const small = size === 'sm';

  return (
    <View
      style={[styles.chip, small && styles.chipSmall, style]}
      accessibilityRole="text"
      accessibilityLabel={`${label}. Saved on this phone and uploads automatically when you are online.`}>
      <View style={[styles.iconWrap, small && styles.iconWrapSmall]}>
        <AppIcon
          name={ICONS.CLOUD_SYNC}
          size={moderateScale(small ? 10 : 12)}
          color={COLORS.white}
        />
      </View>
      <AppText style={[styles.text, small && styles.textSmall]} numberOfLines={1}>
        {label}
      </AppText>
    </View>
  );
};

export default PendingSyncChip;

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexShrink: 0,
    gap: spacing[1.5],
    paddingVertical: scale(3),
    paddingLeft: scale(3),
    paddingRight: spacing[2.5],
    borderRadius: borderRadius.full,
    borderWidth: borderWidth.thin,
    borderColor: addAlpha(COLORS.accent, 0.45),
    backgroundColor: addAlpha(COLORS.accent, 0.14),
  },
  chipSmall: {
    gap: spacing[1],
    paddingVertical: scale(2),
    paddingLeft: scale(2),
    paddingRight: spacing[2],
  },
  iconWrap: {
    width: scale(18),
    height: scale(18),
    borderRadius: borderRadius.full,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapSmall: {
    width: scale(15),
    height: scale(15),
  },
  text: {
    ...presets.labelSM,
    fontFamily: fonts.semibold,
    color: COLORS.accentDark,
  },
  textSmall: {
    ...presets.caption,
    fontFamily: fonts.semibold,
    color: COLORS.accentDark,
  },
});
