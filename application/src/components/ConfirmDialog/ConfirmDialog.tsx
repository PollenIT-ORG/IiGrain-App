import React, { useCallback, useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { AppIcon, ICONS } from '../AppIcon';
import {
  COLORS,
  borderRadius,
  borderWidth,
  presets,
  shadows,
  spacing,
} from '../../constants';
import { addAlpha, moderateScale } from '../../utils';
import AppText from '../AppText/AppText';

export type ConfirmTone = 'danger' | 'primary';

export interface ConfirmDialogProps {
  visible: boolean;
  tone?: ConfirmTone;
  icon?: string;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  embedded?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

const TONE_COLOR: Record<ConfirmTone, string> = {
  danger: COLORS.danger,
  primary: COLORS.primary,
};

const TONE_ICON: Record<ConfirmTone, string> = {
  danger: ICONS.WARNING,
  primary: ICONS.INFO,
};

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  visible,
  tone = 'primary',
  icon,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel,
  loading = false,
  embedded = false,
  onConfirm,
  onClose,
}) => {
  const accent = TONE_COLOR[tone];
  const cardScale = useRef(new Animated.Value(0.92)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      cardScale.setValue(0.92);
      cardOpacity.setValue(0);
      return;
    }
    const animation = Animated.parallel([
      Animated.spring(cardScale, {
        toValue: 1,
        friction: 7,
        tension: 120,
        useNativeDriver: true,
      }),
      Animated.timing(cardOpacity, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [visible, cardScale, cardOpacity]);

  const handleClose = useCallback(() => {
    if (!loading) {
      onClose();
    }
  }, [loading, onClose]);

  const body = (
    <View style={[styles.backdrop, embedded && styles.embedded]}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={handleClose}
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
      />

      <Animated.View
        style={[
          styles.card,
          { opacity: cardOpacity, transform: [{ scale: cardScale }] },
        ]}
      >
        <View
          style={[styles.badge, { backgroundColor: addAlpha(accent, 0.12) }]}
        >
          <AppIcon
            name={icon ?? TONE_ICON[tone]}
            size={moderateScale(28)}
            color={accent}
          />
        </View>

        <AppText style={styles.title}>{title}</AppText>
        {message ? <AppText style={styles.message}>{message}</AppText> : null}

        <View style={styles.actions}>
          {cancelLabel ? (
            <Pressable
              onPress={handleClose}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel={cancelLabel}
              style={({ pressed }) => [
                styles.button,
                styles.cancelButton,
                pressed && styles.pressed,
                loading && styles.disabled,
              ]}
            >
              <AppText style={styles.cancelLabel}>{cancelLabel}</AppText>
            </Pressable>
          ) : null}

          <Pressable
            onPress={onConfirm}
            disabled={loading}
            accessibilityRole="button"
            accessibilityState={{ busy: loading }}
            accessibilityLabel={confirmLabel}
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: accent },
              pressed && styles.pressed,
              loading && styles.disabled,
            ]}
          >
            {loading ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <AppText style={styles.confirmLabel} numberOfLines={1}>
                {confirmLabel}
              </AppText>
            )}
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );

  if (embedded) {
    return visible ? body : null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={handleClose}
    >
      {body}
    </Modal>
  );
};

export default React.memo(ConfirmDialog);

const BADGE = moderateScale(58);

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[6],
  },
  embedded: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
    elevation: 10,
  },
  card: {
    width: '100%',
    maxWidth: moderateScale(340),
    backgroundColor: COLORS.white,
    borderRadius: borderRadius['2xl'],
    paddingHorizontal: spacing[5],
    paddingTop: spacing[6],
    paddingBottom: spacing[5],
    alignItems: 'center',
    ...shadows.lg,
  },
  badge: {
    width: BADGE,
    height: BADGE,
    borderRadius: BADGE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[4],
  },
  title: {
    ...presets.headingSM,
    color: COLORS.gray900,
    textAlign: 'center',
  },
  message: {
    ...presets.bodySM,
    color: COLORS.gray600,
    textAlign: 'center',
    marginTop: spacing[2],
  },
  actions: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    gap: spacing[3],
    marginTop: spacing[6],
  },
  button: {
    flex: 1,
    minHeight: moderateScale(46),
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[4],
  },
  cancelButton: {
    backgroundColor: COLORS.white,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray300,
  },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.6 },
  cancelLabel: {
    ...presets.buttonSM,
    color: COLORS.gray700,
  },
  confirmLabel: {
    ...presets.buttonSM,
    color: COLORS.white,
  },
});
