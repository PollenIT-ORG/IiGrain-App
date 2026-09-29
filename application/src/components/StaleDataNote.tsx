import React from 'react';
import { StyleSheet, View } from 'react-native';
import { COLORS, borderRadius, presets, spacing } from '../constants';
import { addAlpha, moderateScale } from '../utils';
import { AppIcon, ICONS } from './AppIcon';
import AppText from './AppText/AppText';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const describeAge = (capturedAt: string, now: number = Date.now()): string => {
  const captured = Date.parse(capturedAt);
  if (!Number.isFinite(captured)) {
    return 'earlier';
  }
  const age = Math.max(0, now - captured);

  if (age < 2 * MINUTE) {
    return 'just now';
  }
  if (age < HOUR) {
    return `${Math.round(age / MINUTE)} minutes ago`;
  }
  if (age < DAY) {
    const hours = Math.round(age / HOUR);
    return hours === 1 ? 'an hour ago' : `${hours} hours ago`;
  }
  const days = Math.round(age / DAY);
  return days === 1 ? 'yesterday' : `${days} days ago`;
};

export interface StaleDataNoteProps {
  capturedAt?: string | null;
  noun?: string;
}

const StaleDataNote: React.FC<StaleDataNoteProps> = ({
  capturedAt,
  noun = 'These figures',
}) => {
  if (!capturedAt) {
    return null;
  }

  return (
    <View style={styles.note}>
      <AppIcon
        name={ICONS.CLOUD_OFFLINE}
        size={moderateScale(14)}
        color={COLORS.gray700}
      />
      <AppText style={styles.text}>
        {`${noun} were last updated ${describeAge(capturedAt)}. They will refresh when you are back online.`}
      </AppText>
    </View>
  );
};

export default StaleDataNote;

const styles = StyleSheet.create({
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2],
    paddingVertical: spacing[2.5],
    paddingHorizontal: spacing[3],
    borderRadius: borderRadius.lg,
    backgroundColor: addAlpha(COLORS.gray900, 0.05),
  },
  text: {
    ...presets.bodyXS,
    color: COLORS.gray700,
    flex: 1,
  },
});
