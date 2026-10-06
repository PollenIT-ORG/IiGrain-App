import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
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
import type { JoinedField } from '../../utils/enrollmentSuccess';

export interface EnrollSuccessModalProps {
  programName: string;
  fields: JoinedField[];
  onContinue: (field: JoinedField) => void;
  onClose: () => void;
}

const FIELD_FALLBACK = 'Your field';
const MAX_HEIGHT_RATIO = 0.86;

const fieldLabel = (field: JoinedField): string => field.fieldName.trim() || FIELD_FALLBACK;

const choiceLabel = (field: JoinedField): string =>
  field.farmName
    ? `Start with ${fieldLabel(field)}, ${field.farmName}`
    : `Start with ${fieldLabel(field)}`;

const EnrollSuccessModal: React.FC<EnrollSuccessModalProps> = ({
  programName,
  fields,
  onContinue,
  onClose,
}) => {
  const { height } = useWindowDimensions();
  const [chosenId, setChosenId] = useState<string | null>(null);
  const cardScale = useRef(new Animated.Value(0.92)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const badgeScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.parallel([
      Animated.spring(cardScale, {
        toValue: 1,
        friction: 7,
        tension: 120,
        useNativeDriver: true,
      }),
      Animated.timing(cardOpacity, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(badgeScale, {
        toValue: 1,
        friction: 5,
        tension: 90,
        delay: 120,
        useNativeDriver: true,
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [cardScale, cardOpacity, badgeScale]);

  const several = fields.length > 1;
  const chosen = fields.find(field => field.fieldId === chosenId) ?? fields[0];

  const handleContinue = useCallback(() => {
    if (chosen) {
      onContinue(chosen);
    }
  }, [chosen, onContinue]);

  return (
    <View style={styles.backdrop}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onClose}
        accessible={false}
        importantForAccessibility="no"
      />

      <Animated.View
        accessibilityViewIsModal
        style={[
          styles.card,
          { maxHeight: height * MAX_HEIGHT_RATIO },
          { opacity: cardOpacity, transform: [{ scale: cardScale }] },
        ]}>
        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          showsVerticalScrollIndicator={false}>
          <Animated.View style={[styles.badge, { transform: [{ scale: badgeScale }] }]}>
            <AppIcon name={ICONS.CHECK_BOLD} size={moderateScale(32)} color={COLORS.white} />
          </Animated.View>

          <AppText style={styles.title} accessibilityRole="header">
            {several ? `${fields.length} fields added successfully` : 'Field added successfully'}
          </AppText>
          <AppText style={styles.message}>
            {several
              ? 'You have successfully joined these fields to the program. Choose the one to assess first.'
              : 'You have successfully joined this field to the program. Its assessment is ready to start.'}
          </AppText>

          <View style={styles.panel}>
            {programName ? (
              <View style={styles.detail}>
                <View style={styles.detailIcon}>
                  <AppIcon name={ICONS.PROGRAM} size={moderateScale(18)} color={COLORS.primary} />
                </View>
                <View style={styles.detailTexts}>
                  <AppText style={styles.detailLabel}>Program</AppText>
                  <AppText style={styles.detailValue} numberOfLines={2}>
                    {programName}
                  </AppText>
                </View>
              </View>
            ) : null}

            {programName ? <View style={styles.divider} /> : null}

            {several ? (
              <View style={styles.choices} accessibilityRole="radiogroup">
                <AppText style={styles.detailLabel}>Fields</AppText>
                {fields.map(field => {
                  const selected = field.fieldId === chosen?.fieldId;
                  return (
                    <Pressable
                      key={field.fieldId}
                      onPress={() => setChosenId(field.fieldId)}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      accessibilityLabel={choiceLabel(field)}
                      style={({ pressed }) => [
                        styles.choice,
                        selected && styles.choiceSelected,
                        pressed && styles.pressed,
                      ]}>
                      <AppIcon
                        name={selected ? ICONS.CHECK_CIRCLE : ICONS.CIRCLE_OUTLINE}
                        size={moderateScale(20)}
                        color={selected ? COLORS.primary : COLORS.gray500}
                      />
                      <View style={styles.detailTexts}>
                        <AppText style={styles.detailValue} numberOfLines={1}>
                          {fieldLabel(field)}
                        </AppText>
                        {field.farmName ? (
                          <AppText style={styles.detailMeta} numberOfLines={1}>
                            {field.farmName}
                          </AppText>
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ) : chosen ? (
              <View style={styles.detail}>
                <View style={styles.detailIcon}>
                  <AppIcon name={ICONS.FIELD} size={moderateScale(18)} color={COLORS.primary} />
                </View>
                <View style={styles.detailTexts}>
                  <AppText style={styles.detailLabel}>Field</AppText>
                  <AppText style={styles.detailValue} numberOfLines={2}>
                    {fieldLabel(chosen)}
                  </AppText>
                  {chosen.farmName ? (
                    <AppText style={styles.detailMeta} numberOfLines={1}>
                      {chosen.farmName}
                    </AppText>
                  ) : null}
                </View>
              </View>
            ) : null}
          </View>
        </ScrollView>

        <View style={styles.actions}>
          <Button title="Continue Assessment" onPress={handleContinue} disabled={!chosen} />

          <Pressable
            onPress={onClose}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Not now"
            style={({ pressed }) => [styles.laterBtn, pressed && styles.pressed]}>
            <AppText style={styles.laterText}>Not now</AppText>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
};

export default React.memo(EnrollSuccessModal);

const BADGE = moderateScale(68);
const DETAIL_ICON = scale(36);

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
    elevation: 10,
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
    overflow: 'hidden',
    ...shadows.lg,
  },
  body: { flexShrink: 1 },
  bodyContent: {
    alignItems: 'center',
    paddingHorizontal: spacing[5],
    paddingTop: spacing[6],
    paddingBottom: spacing[1],
  },
  badge: {
    width: BADGE,
    height: BADGE,
    borderRadius: BADGE / 2,
    backgroundColor: COLORS.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[4],
    ...shadows.md,
  },
  title: {
    ...presets.headingMD,
    color: COLORS.gray900,
    textAlign: 'center',
  },
  message: {
    ...presets.bodySM,
    color: COLORS.gray600,
    textAlign: 'center',
    marginTop: spacing[2],
  },
  panel: {
    alignSelf: 'stretch',
    backgroundColor: COLORS.gray100,
    borderRadius: borderRadius.xl,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray200,
    padding: spacing[3.5],
    gap: spacing[3],
    marginTop: spacing[5],
  },
  detail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  detailIcon: {
    width: DETAIL_ICON,
    height: DETAIL_ICON,
    borderRadius: borderRadius.lg,
    backgroundColor: addAlpha(COLORS.primary, 0.12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailTexts: { flex: 1, gap: scale(2) },
  detailLabel: { ...presets.caption, color: COLORS.gray600 },
  detailValue: { ...presets.labelLG, color: COLORS.gray900 },
  detailMeta: { ...presets.bodyXS, color: COLORS.gray600 },
  divider: {
    height: borderWidth.thin,
    backgroundColor: COLORS.gray200,
  },
  choices: { gap: spacing[2] },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2.5],
    backgroundColor: COLORS.white,
    borderRadius: borderRadius.lg,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray200,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2.5],
  },
  choiceSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.lightPrimaryBg,
  },
  pressed: { opacity: 0.85 },
  actions: {
    alignItems: 'center',
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing[3],
  },
  laterBtn: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    marginTop: spacing[1],
  },
  laterText: { ...presets.buttonSM, color: COLORS.gray700 },
});
