import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, borderRadius, borderWidth, presets, shadows, spacing } from '../constants';
import { addAlpha, moderateScale, scale } from '../utils';
import { AppIcon, ICONS } from './AppIcon';
import AppText from './AppText/AppText';
import { useSyncStatus } from '../hooks/useSyncStatus';
import type { SyncPhase, SyncStatusApi } from '../hooks/useSyncStatus';

export interface BannerContent {
  readonly icon: string;
  readonly accent: string;
  readonly title: string;
  readonly detail: string;
  readonly spinning: boolean;
  readonly action: string | null;
}

const plural = (count: number, word: string): string =>
  `${count} ${word}${count === 1 ? '' : 's'}`;

export const bannerContentFor = (status: {
  phase: SyncPhase;
  pending: number;
  failed: number;
}): BannerContent | null => {
  switch (status.phase) {
    case 'offline':
      return {
        icon: ICONS.CLOUD_OFFLINE,
        accent: COLORS.gray700,
        title: 'You are offline',
        detail:
          status.pending > 0
            ? `${plural(status.pending, 'change')} saved on this device`
            : 'Keep working — everything saves on this device',
        spinning: false,
        action: null,
      };

    case 'failed':
      return {
        icon: ICONS.CLOUD_ALERT,
        accent: COLORS.danger,
        title: `${plural(status.failed, 'change')} did not sync`,
        detail: 'Nothing was lost. Your work is still on this device.',
        spinning: false,
        action: 'Try again',
      };

    case 'syncing':
      return {
        icon: ICONS.CLOUD_SYNC,
        accent: COLORS.infoBlue,
        title: 'Syncing your work',
        detail: `${plural(status.pending, 'change')} left to send`,
        spinning: true,
        action: null,
      };

    case 'synced':
      return {
        icon: ICONS.CLOUD_CHECK,
        accent: COLORS.success,
        title: 'All changes synced',
        detail: 'Everything you did offline is now saved to your account.',
        spinning: false,
        action: null,
      };

    default:
      return null;
  }
};

interface BannerCardProps {
  content: BannerContent;
  retrying: boolean;
  onAction: () => void;
}

const BannerCard: React.FC<BannerCardProps> = ({ content, retrying, onAction }) => (
  <View style={[styles.card, { borderColor: addAlpha(content.accent, 0.22) }]}>
    <View style={[styles.bubble, { backgroundColor: addAlpha(content.accent, 0.12) }]}>
      {content.spinning ? (
        <ActivityIndicator size="small" color={content.accent} />
      ) : (
        <AppIcon name={content.icon} size={moderateScale(20)} color={content.accent} />
      )}
    </View>

    <View style={styles.texts}>
      <AppText style={styles.title} numberOfLines={1}>
        {content.title}
      </AppText>
      <AppText style={styles.detail} numberOfLines={2}>
        {content.detail}
      </AppText>
    </View>

    {content.action ? (
      <TouchableOpacity
        onPress={onAction}
        disabled={retrying}
        activeOpacity={0.8}
        style={[styles.action, { backgroundColor: addAlpha(content.accent, 0.12) }]}
        accessibilityRole="button"
        accessibilityLabel={content.action}>
        {retrying ? (
          <ActivityIndicator size="small" color={content.accent} />
        ) : (
          <>
            <AppIcon name={ICONS.RETRY} size={moderateScale(14)} color={content.accent} />
            <AppText style={[styles.actionText, { color: content.accent }]}>
              {content.action}
            </AppText>
          </>
        )}
      </TouchableOpacity>
    ) : null}
  </View>
);

export const TAB_BAR_HEIGHT = scale(62);

export const BANNER_HEIGHT = scale(66);

export const bannerOffset = (bottomInset: number): number =>
  bottomInset + TAB_BAR_HEIGHT + spacing[3];

export interface SyncStatusBannerProps {
  status?: SyncStatusApi;
}

const SyncStatusBanner: React.FC<SyncStatusBannerProps> = ({ status: provided }) => {
  const insets = useSafeAreaInsets();
  const live = useSyncStatus();
  const status = provided ?? live;
  const content = bannerContentFor(status);

  const progress = useRef(new Animated.Value(0)).current;
  const [rendered, setRendered] = useState<BannerContent | null>(content);

  useEffect(() => {
    if (content) {
      setRendered(content);
    }
  }, [content]);

  useEffect(() => {
    Animated.timing(progress, {
      toValue: content ? 1 : 0,
      duration: content ? 260 : 200,
      easing: content ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !content) {
        setRendered(null);
      }
    });
  }, [content, progress]);

  if (!rendered) {
    return null;
  }

  return (
    <Animated.View
      pointerEvents={content ? 'box-none' : 'none'}
      style={[
        styles.wrap,
        { bottom: bannerOffset(insets.bottom) },
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [scale(28), 0],
              }),
            },
          ],
        },
      ]}>
      <BannerCard content={rendered} retrying={status.retrying} onAction={status.retry} />
    </Animated.View>
  );
};

export default SyncStatusBanner;

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: spacing[4],
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[3.5],
    borderRadius: borderRadius.xl,
    borderWidth: borderWidth.thin,
    backgroundColor: COLORS.card,
    ...shadows.lg,
  },
  bubble: {
    width: scale(38),
    height: scale(38),
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: {
    flex: 1,
    gap: spacing[0.5],
  },
  title: {
    ...presets.labelMD,
    color: COLORS.gray900,
  },
  detail: {
    ...presets.bodyXS,
    color: COLORS.gray600,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius: borderRadius.full,
    minWidth: scale(84),
    justifyContent: 'center',
  },
  actionText: {
    ...presets.labelSM,
  },
});
