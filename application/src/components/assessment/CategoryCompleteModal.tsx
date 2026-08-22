import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Modal, StyleSheet, View } from 'react-native';
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

export interface CategoryCompleteModalProps {
  visible: boolean;
  categoryName: string;
  answered: number;
  total: number;
  categoriesRemaining: number;
  onOk: () => void;
}

const CategoryCompleteModal: React.FC<CategoryCompleteModalProps> = ({
  visible,
  categoryName,
  answered,
  total,
  categoriesRemaining,
  onOk,
}) => {
  const badgeScale = useRef(new Animated.Value(0)).current;
  const ringScale = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const contentShift = useRef(new Animated.Value(moderateScale(14))).current;
  const barGrow = useRef(new Animated.Value(0)).current;

  const { remaining, allDone, percent, accent } = useMemo(() => {
    const left = Math.max(total - answered, 0);
    const done = total > 0 && left === 0;
    return {
      remaining: left,
      allDone: done,
      percent: total > 0 ? Math.round((answered / total) * 100) : 0,
      accent: done ? COLORS.success : COLORS.primary,
    };
  }, [answered, total]);

  useEffect(() => {
    if (!visible) {
      badgeScale.setValue(0);
      ringScale.setValue(0);
      contentOpacity.setValue(0);
      contentShift.setValue(moderateScale(14));
      barGrow.setValue(0);
      return;
    }

    const animation = Animated.parallel([
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
            duration: 460,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(contentOpacity, {
            toValue: 1,
            duration: 280,
            useNativeDriver: true,
          }),
          Animated.timing(contentShift, {
            toValue: 0,
            duration: 280,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      ]),
      Animated.timing(barGrow, {
        toValue: 1,
        duration: 820,
        delay: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    ]);

    animation.start();
    return () => animation.stop();
  }, [visible, badgeScale, ringScale, contentOpacity, contentShift, barGrow]);

  const ringStyle = {
    opacity: ringScale.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0] }),
    transform: [
      { scale: ringScale.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.9] }) },
    ],
  };

  const barWidth = barGrow.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', `${percent}%`],
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onOk}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.badgeWrap}>
            <Animated.View
              style={[styles.ring, { backgroundColor: accent }, ringStyle]}
            />
            <Animated.View
              style={[
                styles.badge,
                { backgroundColor: accent, transform: [{ scale: badgeScale }] },
              ]}>
              <AppIcon
                name={allDone ? ICONS.CHECK_BOLD : ICONS.CHECK}
                size={moderateScale(38)}
                color={COLORS.white}
              />
            </Animated.View>
          </View>

          <Animated.View
            style={[
              styles.content,
              { opacity: contentOpacity, transform: [{ translateY: contentShift }] },
            ]}>
            <AppText style={styles.title}>
              {allDone ? 'Assessment Complete' : 'Category Complete'}
            </AppText>

            {categoryName ? (
              <View style={styles.categoryChip}>
                <AppIcon
                  name={ICONS.CHECK}
                  size={moderateScale(14)}
                  color={COLORS.primaryDark}
                />
                <AppText style={styles.categoryChipText} numberOfLines={1}>
                  {categoryName}
                </AppText>
              </View>
            ) : null}

            <AppText style={styles.message}>
              {allDone
                ? 'Every question for this field has been answered. You can review and submit your assessment now.'
                : 'Nice work. Choose the category you want to take on next.'}
            </AppText>

            {total > 0 ? (
              <View style={styles.panel}>
                <View style={styles.panelHeader}>
                  <AppText style={styles.panelLabel}>Field progress</AppText>
                  <AppText style={[styles.panelPercent, { color: accent }]}>
                    {percent}%
                  </AppText>
                </View>

                <View style={styles.track}>
                  <Animated.View
                    style={[styles.fill, { width: barWidth, backgroundColor: accent }]}
                  />
                </View>

                <View style={styles.statsRow}>
                  <View style={styles.stat}>
                    <AppText style={[styles.statValue, { color: accent }]}>
                      {answered}
                    </AppText>
                    <AppText style={styles.statLabel}>Answered</AppText>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.stat}>
                    <AppText style={styles.statValue}>{remaining}</AppText>
                    <AppText style={styles.statLabel}>Remaining</AppText>
                  </View>
                </View>
              </View>
            ) : null}

            {!allDone && categoriesRemaining > 0 ? (
              <AppText style={styles.footnote}>
                {categoriesRemaining} categor{categoriesRemaining === 1 ? 'y' : 'ies'}{' '}
                still open in this field
              </AppText>
            ) : null}

            <Button title="OK" onPress={onOk} style={styles.okBtn} />
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
};

export default React.memo(CategoryCompleteModal);

const BADGE = moderateScale(78);

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
    paddingTop: spacing[7],
    paddingBottom: spacing[6],
    alignItems: 'center',
    ...shadows.lg,
  },
  badgeWrap: {
    width: BADGE,
    height: BADGE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[4],
  },
  ring: {
    position: 'absolute',
    width: BADGE,
    height: BADGE,
    borderRadius: BADGE / 2,
  },
  badge: {
    width: BADGE,
    height: BADGE,
    borderRadius: BADGE / 2,
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
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    maxWidth: '100%',
    backgroundColor: COLORS.lightPrimary,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    marginTop: spacing[2],
  },
  categoryChipText: {
    ...presets.labelSM,
    color: COLORS.primaryDark,
    flexShrink: 1,
  },
  message: {
    ...presets.bodySM,
    color: COLORS.gray600,
    textAlign: 'center',
    marginTop: spacing[2.5],
  },
  panel: {
    alignSelf: 'stretch',
    backgroundColor: COLORS.gray100,
    borderRadius: borderRadius.xl,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray200,
    padding: spacing[4],
    gap: spacing[2],
    marginTop: spacing[5],
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  panelLabel: { ...presets.labelMD, color: COLORS.gray700 },
  panelPercent: { ...presets.headingSM },
  track: {
    height: moderateScale(8),
    borderRadius: borderRadius.full,
    backgroundColor: COLORS.gray200,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: borderRadius.full },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing[1],
  },
  stat: { flex: 1, alignItems: 'center', gap: spacing[0.5] },
  statValue: { ...presets.headingMD, color: COLORS.gray900 },
  statLabel: { ...presets.caption, color: COLORS.gray600 },
  statDivider: {
    width: borderWidth.thin,
    height: scale(28),
    backgroundColor: addAlpha(COLORS.gray500, 0.35),
  },
  footnote: {
    ...presets.caption,
    color: COLORS.gray600,
    textAlign: 'center',
    marginTop: spacing[3],
  },
  okBtn: {
    marginTop: spacing[5],
    alignSelf: 'stretch',
  },
});
