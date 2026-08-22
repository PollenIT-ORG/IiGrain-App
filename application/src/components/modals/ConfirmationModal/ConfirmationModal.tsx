import React, { useCallback, useEffect, useRef } from 'react';
import { Animated, Easing, Modal, Pressable, View } from 'react-native';
import { AppIcon } from '../../AppIcon';
import AppText from '../../AppText/AppText';
import Button from '../../Button/Button';
import { COLORS } from '../../../constants';
import { styles, CONFIRM_METRICS } from './ConfirmationModalStyle';
import type { ConfirmationModalProps } from './types';

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  visible,
  title,
  message,
  consequences,
  retains,
  icon,
  tone = 'default',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  hideCancel = false,
  loading = false,
  onConfirm,
  onCancel,
}) => {
  const isDanger = tone === 'danger';
  const accent = isDanger ? COLORS.danger : COLORS.primary;

  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: visible ? CONFIRM_METRICS.enterMs : CONFIRM_METRICS.exitMs,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [visible, progress]);

  const handleCancel = useCallback(() => {
    if (!loading) {
      onCancel();
    }
  }, [loading, onCancel]);

  const scale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [CONFIRM_METRICS.scaleFrom, 1],
  });
  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [CONFIRM_METRICS.liftFrom, 0],
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleCancel}
      statusBarTranslucent>
      <View style={styles.root}>
        <Animated.View style={[styles.backdrop, { opacity: progress }]}>
          <Pressable
            style={styles.backdropPress}
            onPress={handleCancel}
            accessibilityLabel="Dismiss dialog"
          />
        </Animated.View>

        <Animated.View
          accessibilityViewIsModal
          accessibilityRole="alert"
          style={[styles.card, { opacity: progress, transform: [{ scale }, { translateY }] }]}>
          {icon ? (
            <View style={[styles.iconCircle, isDanger && styles.iconCircleDanger]}>
              <AppIcon name={icon} size={CONFIRM_METRICS.iconSize} color={accent} />
            </View>
          ) : null}

          <AppText style={styles.title}>{title}</AppText>
          <AppText style={styles.message}>{message}</AppText>

          {consequences && consequences.length > 0 ? (
            <View style={[styles.list, isDanger && styles.listDanger]}>
              <AppText style={styles.listHeading}>
                {isDanger ? 'This permanently removes' : 'This will clear'}
              </AppText>
              {consequences.map(line => (
                <View key={line} style={styles.listRow}>
                  <View style={[styles.bullet, { backgroundColor: accent }]} />
                  <AppText style={styles.listText}>{line}</AppText>
                </View>
              ))}
            </View>
          ) : null}

          {retains && retains.length > 0 ? (
            <View style={styles.list}>
              <AppText style={styles.listHeading}>This is kept</AppText>
              {retains.map(line => (
                <View key={line} style={styles.listRow}>
                  <View style={[styles.bullet, styles.bulletKeep]} />
                  <AppText style={styles.listText}>{line}</AppText>
                </View>
              ))}
            </View>
          ) : null}

          <View style={styles.actions}>
            {hideCancel ? null : (
              <Button
                title={cancelLabel}
                variant="outline"
                onPress={handleCancel}
                disabled={loading}
                style={styles.action}
              />
            )}
            <Button
              title={confirmLabel}
              variant={isDanger ? 'danger' : 'primary'}
              onPress={onConfirm}
              loading={loading}
              style={styles.action}
            />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

export default React.memo(ConfirmationModal);
