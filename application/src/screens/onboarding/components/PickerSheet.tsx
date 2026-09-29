import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../../../components';
import { AppIcon, ICONS } from '../../../components/AppIcon';
import {
  COLORS,
  borderRadius,
  borderWidth,
  presets,
  shadows,
  spacing,
} from '../../../constants';
import { addAlpha, moderateScale, scale } from '../../../utils';

export interface PickerSheetProps {
  visible: boolean;
  title: string;
  hint?: string;
  onClose: () => void;
  children: React.ReactNode;
}

const PickerSheet: React.FC<PickerSheetProps> = ({
  visible,
  title,
  hint,
  onClose,
  children,
}) => {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing[4] }]}>
              <View style={styles.grabber} />

              <View style={styles.head}>
                <View style={styles.headTexts}>
                  <AppText style={styles.title}>{title}</AppText>
                  {hint ? <AppText style={styles.hint}>{hint}</AppText> : null}
                </View>
                <Pressable
                  onPress={onClose}
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                  hitSlop={10}
                  style={({ pressed }) => [
                    styles.closeButton,
                    pressed && styles.closePressed,
                  ]}>
                  <AppIcon
                    name={ICONS.CLOSE}
                    size={moderateScale(18)}
                    color={COLORS.gray700}
                  />
                </Pressable>
              </View>

              {children}

              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.cancelButton,
                  pressed && styles.cancelPressed,
                ]}>
                <AppText style={styles.cancelText}>Cancel</AppText>
              </Pressable>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

export default React.memo(PickerSheet);

export const PickerSheetLoading: React.FC<{ message: string }> = ({ message }) => (
  <View style={styles.centered}>
    <ActivityIndicator size="small" color={COLORS.primary} />
    <AppText style={styles.centeredText}>{message}</AppText>
  </View>
);

export interface PickerRowProps {
  title: string;
  meta?: string;
  icon: string;
  done?: boolean;
  badge?: { label: string; tone: 'done' | 'todo' };
  disabled?: boolean;
  accessibilityLabel?: string;
  onPress: () => void;
}

export const PickerRow: React.FC<PickerRowProps> = ({
  title,
  meta,
  icon,
  done = false,
  badge,
  disabled = false,
  accessibilityLabel,
  onPress,
}) => (
  <Pressable
    onPress={disabled ? undefined : onPress}
    disabled={disabled}
    accessibilityRole="button"
    accessibilityState={{ disabled }}
    accessibilityLabel={accessibilityLabel ?? title}
    style={({ pressed }) => [
      styles.row,
      done && styles.rowDone,
      pressed && !disabled && styles.rowPressed,
    ]}>
    <View style={[styles.rowIcon, done && styles.rowIconDone]}>
      <AppIcon
        name={icon}
        size={moderateScale(18)}
        color={done ? COLORS.white : COLORS.primary}
      />
    </View>

    <View style={styles.rowTexts}>
      <AppText style={styles.rowTitle} numberOfLines={1}>
        {title}
      </AppText>
      {meta ? (
        <AppText style={styles.rowMeta} numberOfLines={1}>
          {meta}
        </AppText>
      ) : null}
      {badge ? (
        <View
          style={[
            styles.badge,
            badge.tone === 'done' ? styles.badgeDone : styles.badgeTodo,
          ]}>
          <AppText
            style={[
              styles.badgeText,
              badge.tone === 'done' ? styles.badgeTextDone : styles.badgeTextTodo,
            ]}>
            {badge.label}
          </AppText>
        </View>
      ) : null}
    </View>

    {disabled ? null : (
      <View style={[styles.chevron, !done && styles.chevronTodo]}>
        <AppIcon
          name={ICONS.CHEVRON_RIGHT}
          size={moderateScale(18)}
          color={done ? COLORS.gray600 : COLORS.white}
        />
      </View>
    )}
  </Pressable>
);

export const pickerStyles = StyleSheet.create({
  list: {
    flexGrow: 0,
  },
  empty: {
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: spacing[6],
    paddingHorizontal: spacing[2],
  },
  emptyIcon: {
    width: scale(60),
    height: scale(60),
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.lightPrimary,
    marginBottom: spacing[1],
  },
  emptyTitle: {
    ...presets.headingSM,
    color: COLORS.gray900,
  },
  emptyText: {
    ...presets.bodySM,
    color: COLORS.gray600,
    textAlign: 'center',
  },
  emptyAction: {
    marginTop: spacing[3],
    minWidth: scale(200),
  },
});

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: borderRadius['3xl'],
    borderTopRightRadius: borderRadius['3xl'],
    paddingHorizontal: spacing[4],
    paddingTop: spacing[2.5],
    gap: spacing[3],
    maxHeight: '82%',
    ...shadows.xl,
  },
  grabber: {
    alignSelf: 'center',
    width: scale(40),
    height: scale(4),
    borderRadius: borderRadius.full,
    backgroundColor: COLORS.gray300,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
  },
  headTexts: {
    flex: 1,
    gap: scale(3),
  },
  title: {
    ...presets.headingMD,
    color: COLORS.gray900,
  },
  hint: {
    ...presets.bodyXS,
    color: COLORS.gray600,
  },
  closeButton: {
    width: scale(32),
    height: scale(32),
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.gray100,
  },
  closePressed: {
    backgroundColor: COLORS.gray200,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[3],
    marginBottom: spacing[2],
    borderRadius: borderRadius.xl,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.primaryLighter,
    backgroundColor: COLORS.white,
  },
  rowDone: {
    borderColor: COLORS.gray200,
    backgroundColor: COLORS.gray100,
  },
  rowPressed: {
    backgroundColor: COLORS.lightPrimary,
  },
  rowIcon: {
    width: scale(38),
    height: scale(38),
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.lightPrimary,
  },
  rowIconDone: {
    backgroundColor: COLORS.primary,
  },
  rowTexts: {
    flex: 1,
    gap: scale(3),
    alignItems: 'flex-start',
  },
  rowTitle: {
    ...presets.labelLG,
    color: COLORS.gray900,
  },
  rowMeta: {
    ...presets.bodyXS,
    color: COLORS.gray600,
  },
  badge: {
    paddingHorizontal: spacing[2],
    paddingVertical: scale(2),
    borderRadius: borderRadius.full,
  },
  badgeDone: {
    backgroundColor: addAlpha(COLORS.primary, 0.1),
  },
  badgeTodo: {
    backgroundColor: addAlpha(COLORS.accent, 0.16),
  },
  badgeText: {
    ...presets.labelSM,
    fontSize: moderateScale(10),
  },
  badgeTextDone: {
    color: COLORS.primary,
  },
  badgeTextTodo: {
    color: COLORS.validation,
  },
  chevron: {
    width: scale(28),
    height: scale(28),
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.gray100,
  },
  chevronTodo: {
    backgroundColor: COLORS.primary,
  },

  centered: {
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: spacing[10],
  },
  centeredText: {
    ...presets.bodyXS,
    color: COLORS.gray600,
  },

  cancelButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[3.5],
    borderRadius: borderRadius.xl,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray300,
    backgroundColor: COLORS.white,
  },
  cancelPressed: {
    backgroundColor: COLORS.gray100,
  },
  cancelText: {
    ...presets.buttonLG,
    color: COLORS.gray700,
  },
});
