import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon } from './AppIcon';
import { COLORS, borderRadius, presets, shadows, spacing } from '../constants';
import { moderateScale } from '../utils';
import { setToastHandler, ToastOptions, ToastType } from '../services/toastService';
import AppText from './AppText/AppText';

interface ToastState {
  message: string;
  type: ToastType;
}

const DEFAULT_DURATION = 2600;

const ACCENT: Record<ToastType, string> = {
  success: COLORS.success,
  info: COLORS.primary,
  error: COLORS.danger,
};

const ICON: Record<ToastType, string> = {
  success: 'check-circle',
  info: 'information',
  error: 'alert-circle',
};

const GlobalToast: React.FC = () => {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ToastState | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-12)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  }, []);

  const dismiss = useCallback(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(translateY, {
        toValue: -12,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setToast(null);
      }
    });
  }, [opacity, translateY]);

  useEffect(() => {
    const handler = (message: string, options?: ToastOptions) => {
      clearTimer();
      setToast({ message, type: options?.type ?? 'success' });
      opacity.setValue(0);
      translateY.setValue(-12);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true }),
      ]).start();
      hideTimer.current = setTimeout(dismiss, options?.duration ?? DEFAULT_DURATION);
    };
    setToastHandler(handler);
    return () => {
      setToastHandler(null);
      clearTimer();
    };
  }, [clearTimer, dismiss, opacity, translateY]);

  if (!toast) {
    return null;
  }

  return (
    <View
      pointerEvents="none"
      style={[styles.wrapper, { top: insets.top + spacing[2] }]}>
      <Animated.View
        style={[
          styles.toast,
          { borderLeftColor: ACCENT[toast.type], opacity, transform: [{ translateY }] },
        ]}>
        <AppIcon
          name={ICON[toast.type]}
          size={moderateScale(22)}
          color={ACCENT[toast.type]}
        />
        <AppText style={styles.message} numberOfLines={2}>
          {toast.message}
        </AppText>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: spacing[4],
    right: spacing[4],
    alignItems: 'center',
    zIndex: 999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    width: '100%',
    backgroundColor: COLORS.white,
    borderRadius: borderRadius.lg,
    borderLeftWidth: 4,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    ...shadows.lg,
  },
  message: {
    ...presets.bodySM,
    flex: 1,
    color: COLORS.gray900,
  },
});

export default GlobalToast;
