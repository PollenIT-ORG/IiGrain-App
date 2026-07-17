import React from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';
import { AppIcon, ICONS } from '../AppIcon';
import AppText from '../AppText/AppText';
import { COLORS, borderRadius, presets, spacing, fonts } from '../../constants';
import { addAlpha, moderateScale, scale } from '../../utils';
import type { DownloadEntry } from '../../hooks/useFileDownloads';

export interface DownloadStatusButtonProps {
  entry: DownloadEntry;
  onDownload: () => void;
}

const HITSLOP = { top: 8, bottom: 8, left: 8, right: 8 };

const DownloadStatusButton: React.FC<DownloadStatusButtonProps> = ({ entry, onDownload }) => {
  const { status, progress } = entry;

  if (status === 'downloading') {
    return (
      <View style={[styles.pill, styles.pillBusy]}>
        <ActivityIndicator size="small" color={COLORS.primary} />
        <AppText style={styles.pillTextBusy}>{Math.round(progress * 100)}%</AppText>
      </View>
    );
  }

  if (status === 'exists') {
    return (
      <View style={[styles.pill, styles.pillDone]} accessibilityLabel="Saved to device">
        <AppIcon name={ICONS.SUCCESS} size={moderateScale(16)} color={COLORS.primary} />
        <AppText style={styles.pillTextDone}>Saved</AppText>
      </View>
    );
  }

  const isError = status === 'error';
  return (
    <TouchableOpacity
      style={[styles.pill, styles.pillIdle, isError && styles.pillError]}
      hitSlop={HITSLOP}
      activeOpacity={0.85}
      onPress={onDownload}
      accessibilityRole="button"
      accessibilityLabel={isError ? 'Retry download' : 'Download'}>
      <AppIcon
        name={isError ? ICONS.RETRY : ICONS.DOWNLOAD}
        size={moderateScale(16)}
        color={isError ? COLORS.danger : COLORS.primary}
      />
      <AppText style={[styles.pillText, isError && styles.pillTextError]}>
        {isError ? 'Retry' : 'Download'}
      </AppText>
    </TouchableOpacity>
  );
};

export default React.memo(DownloadStatusButton);

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1.5],
    minHeight: scale(34),
    paddingHorizontal: spacing[3],
    borderRadius: borderRadius.full,
  },
  pillIdle: {
    backgroundColor: COLORS.lightPrimary,
  },
  pillBusy: {
    backgroundColor: COLORS.lightPrimary,
  },
  pillDone: {
    backgroundColor: addAlpha(COLORS.primary, 0.1),
  },
  pillError: {
    backgroundColor: addAlpha(COLORS.danger, 0.1),
  },
  pillText: {
    ...presets.labelSM,
    color: COLORS.primary,
    fontFamily: fonts.semibold,
  },
  pillTextBusy: {
    ...presets.labelSM,
    color: COLORS.primary,
    fontFamily: fonts.semibold,
  },
  pillTextDone: {
    ...presets.labelSM,
    color: COLORS.primary,
    fontFamily: fonts.semibold,
  },
  pillTextError: {
    color: COLORS.danger,
  },
});
