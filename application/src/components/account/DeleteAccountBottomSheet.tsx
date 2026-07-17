import React, { useCallback, useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  COLORS,
  borderRadius,
  borderWidth,
  presets,
  shadows,
  spacing,
} from '../../constants';
import { addAlpha, scale } from '../../utils';
import { AppIcon, ICONS } from '../AppIcon';
import AppText from '../AppText/AppText';
import AnimatedCheckbox from './AnimatedCheckbox';
import DangerButton from './DangerButton';
import WarningList from './WarningList';
import {
  BACKDROP_IN_TIMING,
  BACKDROP_OUT_TIMING,
  SHEET_CLOSE_TIMING,
  SHEET_DISMISS_DISTANCE,
  SHEET_DISMISS_VELOCITY,
  SHEET_SPRING,
} from './animations';

export interface DeleteAccountBottomSheetProps {
  visible: boolean;
  items: string[];
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
  error?: string | null;
}

const CHECKBOX_LABEL = 'I understand that this action is permanent and cannot be undone.';

const DeleteAccountBottomSheet: React.FC<DeleteAccountBottomSheetProps> = ({
  visible,
  items,
  onClose,
  onConfirm,
  loading = false,
  error = null,
}) => {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  const [mounted, setMounted] = useState(visible);
  const [checked, setChecked] = useState(false);

  const translateY = useSharedValue(height);
  const backdrop = useSharedValue(0);

  const requestClose = useCallback(() => {
    if (!loading) {
      onClose();
    }
  }, [loading, onClose]);

  useEffect(() => {
    if (visible) {
      setChecked(false);
      translateY.value = height;
      backdrop.value = 0;
      setMounted(true);
    } else if (mounted) {
      backdrop.value = withTiming(0, BACKDROP_OUT_TIMING);
      translateY.value = withTiming(height, SHEET_CLOSE_TIMING, finished => {
        if (finished) {
          runOnJS(setMounted)(false);
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    if (mounted && visible) {
      backdrop.value = withTiming(1, BACKDROP_IN_TIMING);
      translateY.value = withSpring(0, SHEET_SPRING);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  const pan = Gesture.Pan()
    .enabled(!loading)
    .onUpdate(e => {
      translateY.value = Math.max(0, e.translationY);
    })
    .onEnd(e => {
      const shouldClose =
        e.translationY > SHEET_DISMISS_DISTANCE || e.velocityY > SHEET_DISMISS_VELOCITY;
      if (shouldClose) {
        runOnJS(requestClose)();
      } else {
        translateY.value = withSpring(0, SHEET_SPRING);
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }));

  const toggleChecked = useCallback(() => setChecked(c => !c), []);

  if (!mounted) {
    return null;
  }

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={requestClose}>
      <GestureHandlerRootView style={styles.root}>
        <AnimatedPressable
          style={[styles.backdrop, backdropStyle]}
          onPress={requestClose}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
        />

        <View style={styles.anchor} pointerEvents="box-none">
          <GestureDetector gesture={pan}>
            <Animated.View
              style={[
                styles.sheet,
                { paddingBottom: insets.bottom + spacing[5] },
                sheetStyle,
              ]}>
              <View style={styles.handle} />

              <View style={styles.iconCircle}>
                <AppIcon name={ICONS.DELETE} size={scale(30)} color={COLORS.danger} />
              </View>

              <AppText style={styles.title} align="center">
                Delete Account?
              </AppText>
              <AppText style={styles.message} align="center">
                This permanently deletes your iiGrain account and everything tied to
                it. This includes:
              </AppText>

              <WarningList items={items} style={styles.list} />

              <View style={styles.divider} />

              <AnimatedCheckbox
                checked={checked}
                onToggle={toggleChecked}
                label={CHECKBOX_LABEL}
                disabled={loading}
              />

              {error ? (
                <View style={styles.errorBanner}>
                  <AppIcon name={ICONS.ERROR} size={scale(18)} color={COLORS.danger} />
                  <AppText style={styles.errorText}>{error}</AppText>
                </View>
              ) : null}

              <DangerButton
                title="Delete My Account"
                onPress={onConfirm}
                disabled={!checked}
                loading={loading}
                style={styles.confirmBtn}
              />

              <Pressable
                onPress={requestClose}
                disabled={loading}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
                style={styles.cancelBtn}>
                <AppText style={styles.cancelText}>Cancel</AppText>
              </Pressable>
            </Animated.View>
          </GestureDetector>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default React.memo(DeleteAccountBottomSheet);

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.overlay,
  },
  anchor: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: borderRadius['2xl'],
    borderTopRightRadius: borderRadius['2xl'],
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
    ...shadows['2xl'],
  },
  handle: {
    alignSelf: 'center',
    width: scale(40),
    height: scale(4),
    borderRadius: borderRadius.full,
    backgroundColor: COLORS.gray300,
    marginBottom: spacing[5],
  },
  iconCircle: {
    alignSelf: 'center',
    width: scale(64),
    height: scale(64),
    borderRadius: borderRadius.full,
    backgroundColor: addAlpha(COLORS.danger, 0.1),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[4],
  },
  title: {
    ...presets.headingMD,
    color: COLORS.gray900,
    marginBottom: spacing[2],
  },
  message: {
    ...presets.bodySM,
    color: COLORS.gray700,
    marginBottom: spacing[4],
  },
  list: {
    alignSelf: 'stretch',
    marginBottom: spacing[5],
  },
  divider: {
    height: borderWidth.hairline,
    backgroundColor: COLORS.gray200,
    marginBottom: spacing[5],
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginTop: spacing[4],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[3.5],
    borderRadius: borderRadius.md,
    backgroundColor: addAlpha(COLORS.danger, 0.08),
    borderWidth: borderWidth.thin,
    borderColor: addAlpha(COLORS.danger, 0.25),
  },
  errorText: {
    ...presets.bodySM,
    color: COLORS.danger,
    flex: 1,
  },
  confirmBtn: {
    marginTop: spacing[6],
  },
  cancelBtn: {
    marginTop: spacing[3],
    paddingVertical: spacing[3],
    alignItems: 'center',
  },
  cancelText: {
    ...presets.labelLG,
    color: COLORS.gray600,
  },
});
