import React from 'react';
import { StyleSheet, View } from 'react-native';
import AppText from '../AppText/AppText';
import { COLORS, borderRadius, borderWidth, presets, fonts } from '../../constants';
import { addAlpha, scale } from '../../utils';
import type { QuestionScore } from '../../types/assessment';

const SCORE_COLOR: Record<number, string> = {
  0: COLORS.danger,
  1: COLORS.accent,
  2: COLORS.secondary,
  3: COLORS.success,
};

interface ScorePillProps {
  score: QuestionScore | null;
}

const ScorePill: React.FC<ScorePillProps> = ({ score }) => {
  const color = score === null ? COLORS.gray500 : SCORE_COLOR[score] ?? COLORS.gray500;
  return (
    <View
      style={[
        styles.pill,
        { backgroundColor: addAlpha(color, 0.14), borderColor: addAlpha(color, 0.3) },
      ]}>
      <AppText style={[styles.text, { color }]}>{score === null ? '-' : score}</AppText>
    </View>
  );
};

export default React.memo(ScorePill);

const styles = StyleSheet.create({
  pill: {
    minWidth: scale(32),
    height: scale(32),
    borderRadius: borderRadius.md,
    borderWidth: borderWidth.thin,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  text: { ...presets.labelMD, fontFamily: fonts.semibold },
});
