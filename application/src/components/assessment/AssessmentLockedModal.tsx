import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, View } from 'react-native';
import { AppIcon, ICONS } from '../AppIcon';
import {
  COLORS,
  borderRadius,
  borderWidth,
  presets,
  shadows,
  spacing,
} from '../../constants';
import { addAlpha, moderateScale, scale } from '../../utils';
import AppText from '../AppText/AppText';
import Button from '../Button/Button';

export type AssessmentLockState = 'no_visit' | 'other_field' | 'en_route';

export interface AssessmentLockedModalProps {
  visible: boolean;
  state: AssessmentLockState;
  fieldName?: string | null;
  otherFieldName?: string | null;
  onOpenVisit?: () => void;
  onClose: () => void;
}

interface Step {
  key: string;
  title: string;
  detail: string;
}

const STEPS: Step[] = [
  {
    key: 'start',
    title: 'Start the visit',
    detail: 'Open the farm, find this field and tap Start visit.',
  },
  {
    key: 'travel',
    title: 'Travel to the field',
    detail: 'Your live location is shared with the farmer on the way.',
  },
  {
    key: 'arrive',
    title: 'Tap “Mark as arrived”',
    detail: 'Do it standing on the field — your position is checked against its boundary.',
  },
  {
    key: 'assess',
    title: 'The assessment unlocks',
    detail: 'Score every category and submit before you end the visit.',
  },
];

const ENTER_MS = 220;
const EXIT_MS = 160;

const AssessmentLockedModal: React.FC<AssessmentLockedModalProps> = ({
  visible,
  state,
  fieldName,
  otherFieldName,
  onOpenVisit,
  onClose,
}) => {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: visible ? ENTER_MS : EXIT_MS,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [visible, progress]);

  const cardScale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] });
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [12, 0] });

  const field = fieldName?.trim() || 'this field';

  const { chipLabel, chipTone, message, doneCount } = useMemo(() => {
    switch (state) {
      case 'en_route':
        return {
          chipLabel: 'On the way',
          chipTone: COLORS.accent,
          doneCount: 1,
          message: `You are on your way to ${field}. The moment you reach it and mark the visit as arrived, every category opens for scoring.`,
        };
      case 'other_field':
        return {
          chipLabel: 'Other field',
          chipTone: COLORS.accent,
          doneCount: 0,
          message: `Your live visit is for ${
            otherFieldName?.trim() || 'another field'
          }. Finish that visit first, then start one for ${field} to score it.`,
        };
      default:
        return {
          chipLabel: 'Not started',
          chipTone: COLORS.gray500,
          doneCount: 0,
          message: `${field} is scored on the field, not from the office. Start a visit for it, travel there and mark yourself arrived — the questions open right after that.`,
        };
    }
  }, [state, field, otherFieldName]);

  const handleOpenVisit = useCallback(() => {
    onClose();
    onOpenVisit?.();
  }, [onClose, onOpenVisit]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent>
      <View style={styles.root}>
        <Animated.View style={[styles.backdrop, { opacity: progress }]}>
          <Pressable
            style={styles.backdropPress}
            onPress={onClose}
            accessibilityLabel="Dismiss"
          />
        </Animated.View>

        <Animated.View
          accessibilityViewIsModal
          accessibilityRole="alert"
          style={[
            styles.card,
            { opacity: progress, transform: [{ scale: cardScale }, { translateY }] },
          ]}>
          <View style={styles.head}>
            <View style={styles.iconCircle}>
              <AppIcon name={ICONS.LOCK} size={moderateScale(26)} color={COLORS.primary} />
            </View>
            <View style={[styles.chip, { backgroundColor: addAlpha(chipTone, 0.14) }]}>
              <View style={[styles.chipDot, { backgroundColor: chipTone }]} />
              <AppText style={[styles.chipText, { color: chipTone }]}>{chipLabel}</AppText>
            </View>
          </View>

          <AppText style={styles.title}>Reach the field to unlock</AppText>
          <AppText style={styles.message}>{message}</AppText>

          <View style={styles.steps}>
            {STEPS.map((step, i) => {
              const done = i < doneCount;
              const current = i === doneCount;
              return (
                <View key={step.key} style={styles.stepRow}>
                  <View style={styles.stepRail}>
                    <View
                      style={[
                        styles.stepBadge,
                        done && styles.stepBadgeDone,
                        current && styles.stepBadgeCurrent,
                      ]}>
                      {done ? (
                        <AppIcon
                          name={ICONS.CHECK}
                          size={moderateScale(12)}
                          color={COLORS.white}
                        />
                      ) : (
                        <AppText
                          style={[
                            styles.stepNumber,
                            current && styles.stepNumberCurrent,
                          ]}>
                          {i + 1}
                        </AppText>
                      )}
                    </View>
                    {i < STEPS.length - 1 ? <View style={styles.stepLine} /> : null}
                  </View>

                  <View
                    style={[
                      styles.stepTexts,
                      i < STEPS.length - 1 && styles.stepTextsGap,
                    ]}>
                    <AppText
                      style={[styles.stepTitle, current && styles.stepTitleCurrent]}>
                      {step.title}
                    </AppText>
                    <AppText style={styles.stepDetail}>{step.detail}</AppText>
                  </View>
                </View>
              );
            })}
          </View>

          <View style={styles.actions}>
            <Button
              title={onOpenVisit ? 'Got it' : 'Close'}
              variant="outline"
              onPress={onClose}
              style={styles.action}
            />
            {onOpenVisit ? (
              <Button title="Open visit" onPress={handleOpenVisit} style={styles.action} />
            ) : null}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

export default React.memo(AssessmentLockedModal);

const BADGE = scale(22);

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[6],
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: addAlpha(COLORS.black, 0.45),
  },
  backdropPress: { flex: 1 },
  card: {
    width: '100%',
    maxWidth: scale(400),
    backgroundColor: COLORS.white,
    borderRadius: borderRadius['2xl'],
    padding: spacing[5],
    gap: spacing[3],
    ...shadows.xl,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
  },
  iconCircle: {
    width: scale(52),
    height: scale(52),
    borderRadius: borderRadius.full,
    backgroundColor: COLORS.lightPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1.5],
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
  },
  chipDot: {
    width: scale(6),
    height: scale(6),
    borderRadius: borderRadius.full,
  },
  chipText: { ...presets.labelSM },
  title: { ...presets.headingSM, color: COLORS.gray900 },
  message: { ...presets.bodySM, color: COLORS.gray700 },

  steps: {
    backgroundColor: COLORS.gray100,
    borderRadius: borderRadius.lg,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray200,
    padding: spacing[3.5],
  },
  stepRow: { flexDirection: 'row', gap: spacing[3] },
  stepRail: { alignItems: 'center', width: BADGE },
  stepBadge: {
    width: BADGE,
    height: BADGE,
    borderRadius: borderRadius.full,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray300,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeDone: {
    backgroundColor: COLORS.success,
    borderColor: COLORS.success,
  },
  stepBadgeCurrent: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  stepLine: {
    flex: 1,
    width: borderWidth.medium,
    backgroundColor: COLORS.gray300,
    marginVertical: spacing[1],
  },
  stepNumber: { ...presets.caption, color: COLORS.gray600 },
  stepNumberCurrent: { color: COLORS.white },
  stepTexts: { flex: 1, gap: spacing[0.5] },
  stepTextsGap: { paddingBottom: spacing[3] },
  stepTitle: { ...presets.labelMD, color: COLORS.gray900 },
  stepTitleCurrent: { color: COLORS.primaryDark },
  stepDetail: { ...presets.bodyXS, color: COLORS.gray600 },

  actions: { flexDirection: 'row', gap: spacing[3], marginTop: spacing[1] },
  action: { flex: 1 },
});
