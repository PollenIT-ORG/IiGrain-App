import React from 'react';
import { StyleSheet, View } from 'react-native';
import {
  presets,
  spacing,
  progressColorForPercent,
  progressTierForPercent,
  PROGRESS_TIER_LABEL,
} from '../../constants';
import AppText from '../AppText/AppText';
import AssessmentProgressBar from './AssessmentProgressBar';

export interface AssessmentProgressMeterProps {
  progress: number;
  isComplete: boolean;
  backgroundColor?: string;
}

const AssessmentProgressMeter: React.FC<AssessmentProgressMeterProps> = ({
  progress,
  isComplete,
  backgroundColor,
}) => {
  const displayProgress = isComplete ? 100 : Math.round(progress);
  const tierColor = progressColorForPercent(displayProgress);
  const tierLabel = PROGRESS_TIER_LABEL[progressTierForPercent(displayProgress)];

  return (
    <View style={styles.wrap}>
      <AssessmentProgressBar
        progress={displayProgress}
        colorByPercent={!isComplete}
        backgroundColor={backgroundColor}
      />
      {!isComplete ? (
        <AppText style={[styles.tierText, { color: tierColor }]}>{tierLabel}</AppText>
      ) : null}
    </View>
  );
};

export default React.memo(AssessmentProgressMeter);

const styles = StyleSheet.create({
  wrap: {
    gap: spacing[1],
  },
  tierText: {
    ...presets.labelSM,
  },
});
