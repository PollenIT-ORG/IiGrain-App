import React, { useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { AppIcon, ICONS } from '../AppIcon';
import {
  COLORS,
  borderRadius,
  borderWidth,
  presets,
  spacing,
} from '../../constants';
import { addAlpha, moderateScale, scale } from '../../utils';
import AppText from '../AppText/AppText';
import type {
  QuestionScore,
  QuestionScoreDescription,
} from '../../types/assessment';

export interface ScoreOption {
  value: QuestionScore;
  title: string;
  subtitle: string;
  color: string;
}

export const SCORE_OPTIONS: ScoreOption[] = [
  { value: 0, title: 'Conventional', subtitle: 'No action', color: COLORS.danger },
  { value: 1, title: 'Awareness', subtitle: 'Beginning', color: COLORS.accent },
  { value: 2, title: 'Developing', subtitle: 'Implementing', color: COLORS.infoBlue },
  { value: 3, title: 'Advanced', subtitle: 'Regenerative', color: COLORS.success },
];

interface ScoreCardProps {
  option: ScoreOption;
  description: string;
  selected: boolean;
  readOnly?: boolean;
  onSelect: (value: QuestionScore) => void;
}

const ScoreCard: React.FC<ScoreCardProps> = ({
  option,
  description,
  selected,
  readOnly = false,
  onSelect,
}) => {
  const press = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withTiming(press.value ? 0.96 : 1, { duration: 120 }) }],
  }));

  const handlePressIn = useCallback(() => {
    press.value = 1;
  }, [press]);
  const handlePressOut = useCallback(() => {
    press.value = 0;
  }, [press]);
  const handlePress = useCallback(() => onSelect(option.value), [onSelect, option.value]);

  const dimmed = readOnly && !selected;

  return (
    <Animated.View style={[styles.cardWrap, animatedStyle]}>
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={readOnly}
        accessibilityRole="radio"
        accessibilityState={{ selected, disabled: readOnly }}
        accessibilityLabel={`Score ${option.value}: ${option.title}. ${description}`}
        style={[
          styles.card,
          {
            borderColor: selected ? option.color : COLORS.gray300,
            borderWidth: selected ? borderWidth.thick : borderWidth.thin,
            backgroundColor: selected ? addAlpha(option.color, 0.08) : COLORS.white,
          },
          dimmed && styles.cardDimmed,
        ]}>
        {selected ? (
          <View style={[styles.check, { backgroundColor: option.color }]}>
            <AppIcon name={ICONS.CHECK} size={moderateScale(12)} color={COLORS.white} />
          </View>
        ) : null}

        <AppText style={styles.value} color={option.color}>
          {option.value}
        </AppText>
        <AppText style={styles.title} color={COLORS.gray900} numberOfLines={1}>
          {option.title}
        </AppText>
        <AppText style={styles.subtitle} color={COLORS.gray600}>
          {description}
        </AppText>
      </Pressable>
    </Animated.View>
  );
};

export interface ScoreSelectorProps {
  value: QuestionScore | null;
  onChange: (value: QuestionScore) => void;
  readOnly?: boolean;
  descriptions?: QuestionScoreDescription[];
}

const ScoreSelector: React.FC<ScoreSelectorProps> = ({
  value,
  onChange,
  readOnly = false,
  descriptions,
}) => {
  const descriptionByScore = useMemo(() => {
    const map = new Map<QuestionScore, string>();
    descriptions?.forEach(item => {
      if (item.description) {
        map.set(item.score, item.description);
      }
    });
    return map;
  }, [descriptions]);

  return (
    <View style={styles.grid}>
      {SCORE_OPTIONS.map(option => (
        <ScoreCard
          key={option.value}
          option={option}
          description={descriptionByScore.get(option.value) ?? option.subtitle}
          selected={value === option.value}
          readOnly={readOnly}
          onSelect={onChange}
        />
      ))}
    </View>
  );
};

export default React.memo(ScoreSelector);

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[3],
  },
  cardWrap: {
    width: '47.8%',
    flexGrow: 1,
  },
  card: {
    flex: 1,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[3],
    alignItems: 'center',
    gap: spacing[1],
    minHeight: scale(96),
    justifyContent: 'center',
  },
  cardDimmed: {
    opacity: 0.45,
  },
  check: {
    position: 'absolute',
    top: spacing[2],
    right: spacing[2],
    width: scale(20),
    height: scale(20),
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    ...presets.headingLG,
  },
  title: {
    ...presets.labelMD,
    letterSpacing: 0,
    textAlign: 'center',
  },
  subtitle: {
    ...presets.bodyXS,
    textAlign: 'center',
  },
});
