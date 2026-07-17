import React, { useCallback, useEffect, useRef } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon } from '../AppIcon';
import {
  COLORS,
  borderRadius,
  borderWidth,
  presets,
  spacing,
} from '../../constants';
import { moderateScale, scale } from '../../utils';
import AppText from '../AppText/AppText';

export interface SheetAction {
  key: string;
  icon: string;
  label: string;
  onPress: () => void;
  danger?: boolean;
}

export interface ImagePickerBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  actions?: SheetAction[];
  onCamera?: () => void;
  onGallery?: () => void;
  onRemove?: () => void;
  showRemove?: boolean;
  title?: string;
  cameraLabel?: string;
  galleryLabel?: string;
  removeLabel?: string;
  cancelLabel?: string;
}

const ImagePickerBottomSheet: React.FC<ImagePickerBottomSheetProps> = ({
  visible,
  onClose,
  actions,
  onCamera,
  onGallery,
  onRemove,
  showRemove = false,
  title = 'Add Photo',
  cameraLabel = 'Take Photo',
  galleryLabel = 'Choose from Gallery',
  removeLabel = 'Remove Photo',
  cancelLabel = 'Cancel',
}) => {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(0)).current;
  const backdrop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      translateY.setValue(scale(320));
      Animated.parallel([
        Animated.timing(backdrop, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          damping: 22,
          stiffness: 220,
          mass: 0.9,
        }),
      ]).start();
    }
  }, [visible, translateY, backdrop]);

  const animateClose = useCallback(
    (after?: () => void) => {
      Animated.parallel([
        Animated.timing(backdrop, { toValue: 0, duration: 160, useNativeDriver: true }),
        Animated.timing(translateY, {
          toValue: scale(320),
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start(() => {
        onClose();
        after?.();
      });
    },
    [backdrop, translateY, onClose],
  );

  const handleAction = useCallback(
    (action: () => void) => animateClose(action),
    [animateClose],
  );

  const baseActions: SheetAction[] = actions ?? [];
  if (!actions) {
    if (onCamera) {
      baseActions.push({ key: 'camera', icon: 'camera-outline', label: cameraLabel, onPress: onCamera });
    }
    if (onGallery) {
      baseActions.push({ key: 'gallery', icon: 'image-multiple-outline', label: galleryLabel, onPress: onGallery });
    }
    if (showRemove && onRemove) {
      baseActions.push({ key: 'remove', icon: 'trash-can-outline', label: removeLabel, onPress: onRemove, danger: true });
    }
  }
  const resolvedActions: SheetAction[] = baseActions.map(action => ({
    ...action,
    onPress: () => handleAction(action.onPress),
  }));

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={() => animateClose()}>
      <Animated.View style={[styles.backdrop, { opacity: backdrop }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityLabel="Dismiss"
          onPress={() => animateClose()}
        />
      </Animated.View>

      <View style={styles.container} pointerEvents="box-none">
        <Animated.View
          style={[
            styles.sheet,
            { paddingBottom: insets.bottom + spacing[3], transform: [{ translateY }] },
          ]}>
          <View style={styles.grabber} />
          {title ? <AppText style={styles.title}>{title}</AppText> : null}

          <View style={styles.card}>
            {resolvedActions.map((action, index) => (
              <Pressable
                key={action.key}
                onPress={action.onPress}
                accessibilityRole="button"
                accessibilityLabel={action.label}
                style={({ pressed }) => [
                  styles.row,
                  index < resolvedActions.length - 1 && styles.rowDivider,
                  pressed && styles.rowPressed,
                ]}>
                <AppIcon
                  name={action.icon}
                  size={moderateScale(22)}
                  color={action.danger ? COLORS.danger : COLORS.primary}
                />
                <AppText
                  style={styles.rowLabel}
                  color={action.danger ? COLORS.danger : COLORS.gray900}>
                  {action.label}
                </AppText>
              </Pressable>
            ))}
          </View>

          <Pressable
            onPress={() => animateClose()}
            accessibilityRole="button"
            accessibilityLabel={cancelLabel}
            style={({ pressed }) => [styles.cancel, pressed && styles.rowPressed]}>
            <AppText style={styles.cancelLabel} color={COLORS.gray900}>
              {cancelLabel}
            </AppText>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
};

export default React.memo(ImagePickerBottomSheet);

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.overlay,
  },
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[2],
  },
  grabber: {
    alignSelf: 'center',
    width: scale(40),
    height: scale(4),
    borderRadius: borderRadius.full,
    backgroundColor: COLORS.gray300,
    marginBottom: spacing[3],
  },
  title: {
    ...presets.labelMD,
    color: COLORS.gray700,
    textAlign: 'center',
    marginBottom: spacing[2],
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: borderRadius.xl,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray300,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[4],
  },
  rowDivider: {
    borderBottomWidth: borderWidth.hairline,
    borderBottomColor: COLORS.gray300,
  },
  rowPressed: {
    backgroundColor: COLORS.gray100,
  },
  rowLabel: {
    ...presets.labelLG,
    letterSpacing: 0,
  },
  cancel: {
    marginTop: spacing[3],
    backgroundColor: COLORS.white,
    borderRadius: borderRadius.xl,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray300,
    paddingVertical: spacing[4],
    alignItems: 'center',
  },
  cancelLabel: {
    ...presets.labelLG,
    letterSpacing: 0,
  },
});
