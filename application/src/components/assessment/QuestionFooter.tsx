import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppIcon, ICONS } from '../AppIcon';
import { COLORS, borderWidth, presets, spacing } from '../../constants';
import { moderateScale } from '../../utils';
import AppText from '../AppText/AppText';
import Button from '../Button/Button';

export interface QuestionFooterProps {
  isFirst: boolean;
  isLast: boolean;
  savingDraft?: boolean;
  submitting?: boolean;
  readOnly?: boolean;
  primaryLabel?: string;
  onPrevious: () => void;
  onSaveDraft: () => void;
  onNext: () => void;
  onNextQuestion?: () => void;
}

const QuestionFooter: React.FC<QuestionFooterProps> = ({
  isFirst,
  isLast,
  savingDraft = false,
  submitting = false,
  readOnly = false,
  primaryLabel,
  onPrevious,
  onSaveDraft,
  onNext,
  onNextQuestion,
}) => {
  if (readOnly) {
    return (
      <View style={styles.row}>
        <Button
          title=""
          onPress={onPrevious}
          variant="outline"
          disabled={isFirst}
          fullWidth={false}
          style={styles.iconButton}
          leftIcon={
            <AppIcon
              name={ICONS.CHEVRON_LEFT}
              size={moderateScale(22)}
              color={isFirst ? COLORS.gray500 : COLORS.primary}
            />
          }
        />

        <View style={styles.lockedCenter}>
          <AppIcon name={ICONS.LOCK} size={moderateScale(15)} color={COLORS.gray500} />
          <AppText style={styles.lockedText}>View only</AppText>
        </View>

        <Button
          title=""
          onPress={onNextQuestion ?? onPrevious}
          variant="outline"
          disabled={isLast}
          fullWidth={false}
          style={styles.iconButton}
          leftIcon={
            <AppIcon
              name={ICONS.CHEVRON_RIGHT}
              size={moderateScale(22)}
              color={isLast ? COLORS.gray500 : COLORS.primary}
            />
          }
        />
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <Button
        title=""
        onPress={onPrevious}
        variant="outline"
        disabled={isFirst}
        fullWidth={false}
        style={styles.iconButton}
        leftIcon={
          <AppIcon
            name={ICONS.CHEVRON_LEFT}
            size={moderateScale(22)}
            color={isFirst ? COLORS.gray500 : COLORS.primary}
          />
        }
      />

      <View style={styles.flexButton}>
        <Button
          title="Save Draft"
          onPress={onSaveDraft}
          variant="outline"
          loading={savingDraft}
          size="sm"
        />
      </View>

      <View style={styles.flexButtonWide}>
        <Button
          title={primaryLabel ?? (isLast ? 'Review' : 'Next')}
          onPress={onNext}
          variant="primary"
          loading={submitting}
          size="sm"
        />
      </View>
    </View>
  );
};

export default React.memo(QuestionFooter);

export const reviewLabel = 'Review Assessment';

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2.5],
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3],
    borderTopWidth: borderWidth.thin,
    borderTopColor: COLORS.gray300,
    backgroundColor: COLORS.white,
  },
  iconButton: {
    width: moderateScale(48),
    paddingHorizontal: 0,
  },
  flexButton: {
    flex: 1,
  },
  flexButtonWide: {
    flex: 1.3,
  },
  lockedCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[1.5],
  },
  lockedText: {
    ...presets.labelMD,
    color: COLORS.gray700,
  },
});
