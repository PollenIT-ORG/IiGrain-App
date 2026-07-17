import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Modal, StyleSheet, View } from 'react-native';
import { AppIcon, ICONS } from '../AppIcon';
import {
  COLORS,
  borderRadius,
  presets,
  shadows,
  spacing,
} from '../../constants';
import { addAlpha, moderateScale } from '../../utils';
import AppText from '../AppText/AppText';
import Button from '../Button/Button';

export interface AssessmentSubmitSuccessProps {
  visible: boolean;
  title?: string;
  message?: string;
  scoreLabel?: string;
  percentLabel?: string;
  onDone: () => void;
}

const AssessmentSubmitSuccess: React.FC<AssessmentSubmitSuccessProps> = ({
  visible,
  title = 'Assessment Submitted',
  message,
  scoreLabel,
  percentLabel,
  onDone,
}) => {
  const badgeScale = useRef(new Animated.Value(0)).current;
  const ringScale = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const contentShift = useRef(new Animated.Value(moderateScale(12))).current;

  useEffect(() => {
    if (!visible) {
      badgeScale.setValue(0);
      ringScale.setValue(0);
      contentOpacity.setValue(0);
      contentShift.setValue(moderateScale(12));
      return;
    }

    Animated.sequence([
      Animated.spring(badgeScale, {
        toValue: 1,
        friction: 5,
        tension: 90,
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(ringScale, {
          toValue: 1,
          duration: 420,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(contentOpacity, {
          toValue: 1,
          duration: 260,
          useNativeDriver: true,
        }),
        Animated.timing(contentShift, {
          toValue: 0,
          duration: 260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [visible, badgeScale, ringScale, contentOpacity, contentShift]);

  const ringStyle = {
    opacity: ringScale.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }),
    transform: [
      { scale: ringScale.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.8] }) },
    ],
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDone}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.badgeWrap}>
            <Animated.View style={[styles.ring, ringStyle]} />
            <Animated.View style={[styles.badge, { transform: [{ scale: badgeScale }] }]}>
              <AppIcon name={ICONS.CHECK_BOLD} size={moderateScale(40)} color={COLORS.white} />
            </Animated.View>
          </View>

          <Animated.View
            style={[
              styles.content,
              { opacity: contentOpacity, transform: [{ translateY: contentShift }] },
            ]}>
            <AppText style={styles.title}>{title}</AppText>
            {message ? <AppText style={styles.message}>{message}</AppText> : null}

            {scoreLabel || percentLabel ? (
              <View style={styles.chipsRow}>
                {scoreLabel ? (
                  <View style={styles.chip}>
                    <AppIcon
                      name={ICONS.SPARKLE}
                      size={moderateScale(14)}
                      color={COLORS.primary}
                    />
                    <AppText style={styles.chipText}>{scoreLabel}</AppText>
                  </View>
                ) : null}
                {percentLabel ? (
                  <View style={styles.chip}>
                    <AppIcon
                      name={ICONS.SCORE_ARC}
                      size={moderateScale(14)}
                      color={COLORS.primary}
                    />
                    <AppText style={styles.chipText}>{percentLabel}</AppText>
                  </View>
                ) : null}
              </View>
            ) : null}

            <Button title="Done" onPress={onDone} style={styles.doneBtn} />
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
};

export default AssessmentSubmitSuccess;

const BADGE = moderateScale(84);

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[6],
  },
  card: {
    width: '100%',
    maxWidth: moderateScale(360),
    backgroundColor: COLORS.white,
    borderRadius: borderRadius['2xl'],
    paddingHorizontal: spacing[6],
    paddingTop: spacing[8],
    paddingBottom: spacing[6],
    alignItems: 'center',
    ...shadows.lg,
  },
  badgeWrap: {
    width: BADGE,
    height: BADGE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[5],
  },
  ring: {
    position: 'absolute',
    width: BADGE,
    height: BADGE,
    borderRadius: BADGE / 2,
    backgroundColor: addAlpha(COLORS.success, 1),
  },
  badge: {
    width: BADGE,
    height: BADGE,
    borderRadius: BADGE / 2,
    backgroundColor: COLORS.success,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.md,
  },
  content: {
    alignItems: 'center',
    width: '100%',
  },
  title: {
    ...presets.headingMD,
    color: COLORS.gray900,
    textAlign: 'center',
  },
  message: {
    ...presets.bodySM,
    color: COLORS.gray700,
    textAlign: 'center',
    marginTop: spacing[2],
  },
  chipsRow: {
    flexDirection: 'row',
    gap: spacing[2],
    marginTop: spacing[4],
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    backgroundColor: COLORS.lightPrimary,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
  },
  chipText: {
    ...presets.labelMD,
    color: COLORS.primaryDark,
  },
  doneBtn: {
    marginTop: spacing[6],
    alignSelf: 'stretch',
  },
});
