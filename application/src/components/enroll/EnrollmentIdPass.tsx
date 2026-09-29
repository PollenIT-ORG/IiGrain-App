import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { AppIcon, ICONS } from '../AppIcon';
import AppText from '../AppText/AppText';
import {
  COLORS,
  borderRadius,
  borderWidth,
  fonts,
  presets,
  spacing,
} from '../../constants';
import { addAlpha, moderateScale } from '../../utils';
import { copyText } from '../../utils/clipboard';
import { showSuccess, showToast } from '../../services/toastService';

const COPIED_RESET_MS = 2000;
const COPY_HIT_SLOP = { top: 12, bottom: 12, left: 12, right: 12 };

export const copyEnrollmentId = async (enrollmentId: string): Promise<boolean> => {
  const outcome = await copyText(enrollmentId);
  if (outcome === 'copied') {
    showSuccess('Enrollment ID copied');
    return true;
  }
  if (outcome === 'failed') {
    showToast('Could not copy the Enrollment ID. Press and hold it to select it instead.', {
      type: 'error',
    });
  }
  return false;
};

interface EnrollmentIdPassProps {
  enrollmentId: string;
}

const EnrollmentIdPass: React.FC<EnrollmentIdPassProps> = ({ enrollmentId }) => {
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (resetTimer.current) {
        clearTimeout(resetTimer.current);
      }
    },
    [],
  );

  const handleCopy = useCallback(async () => {
    const didCopy = await copyEnrollmentId(enrollmentId);
    if (!didCopy) {
      return;
    }
    setCopied(true);
    if (resetTimer.current) {
      clearTimeout(resetTimer.current);
    }
    resetTimer.current = setTimeout(() => setCopied(false), COPIED_RESET_MS);
  }, [enrollmentId]);

  const tint = copied ? COLORS.success : COLORS.primaryDark;

  return (
    <Pressable
      onPress={handleCopy}
      hitSlop={COPY_HIT_SLOP}
      accessibilityRole="button"
      accessibilityLabel={
        copied
          ? 'Enrollment ID copied'
          : `Enrollment ID ${enrollmentId}. Tap to copy.`
      }
      style={({ pressed }) => [
        styles.chip,
        copied && styles.chipDone,
        pressed && !copied && styles.chipPressed,
      ]}>
      <AppIcon name={ICONS.ID_CARD} size={moderateScale(13)} color={tint} />
      <AppText style={[styles.id, copied && styles.idDone]} numberOfLines={1}>
        {copied ? 'Copied' : enrollmentId}
      </AppText>
      <AppIcon
        name={copied ? ICONS.CHECK : ICONS.COPY}
        size={moderateScale(13)}
        color={tint}
      />
    </Pressable>
  );
};

export default EnrollmentIdPass;

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1.5],
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.full,
    borderWidth: borderWidth.thin,
    borderColor: addAlpha(COLORS.primary, 0.28),
    backgroundColor: COLORS.lightPrimary,
    flexShrink: 0,
  },
  chipPressed: {
    backgroundColor: addAlpha(COLORS.primary, 0.16),
  },
  chipDone: {
    borderColor: addAlpha(COLORS.success, 0.4),
    backgroundColor: addAlpha(COLORS.success, 0.14),
  },
  id: {
    ...presets.caption,
    fontFamily: fonts.semibold,
    color: COLORS.primaryDark,
    letterSpacing: 0.4,
  },
  idDone: {
    color: COLORS.success,
  },
});
