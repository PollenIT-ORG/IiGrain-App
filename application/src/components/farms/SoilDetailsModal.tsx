import React, { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon, ICONS } from '../AppIcon';
import AppText from '../AppText/AppText';
import Input from '../Input/Input';
import Button from '../Button/Button';
import AppDatePicker from '../AppDatePicker';
import {
  API_LIMITS,
  COLORS,
  borderRadius,
  borderWidth,
  presets,
  shadows,
  spacing,
} from '../../constants';
import { addAlpha, moderateScale, scale } from '../../utils';
import {
  BACKDROP_IN_TIMING,
  BACKDROP_OUT_TIMING,
  SHEET_CLOSE_TIMING,
  SHEET_DISMISS_DISTANCE,
  SHEET_DISMISS_VELOCITY,
  SHEET_SPRING,
} from '../account/animations';

export interface SoilValues {
  texture: string;
  ph: string;
  organicMatter: string;
  nitrogen: string;
  phosphorus: string;
  potassium: string;
  moisture: string;
  testedOn: string;
  notes: string;
}

export interface SoilDetailsModalProps {
  visible: boolean;
  onClose: () => void;
  values: SoilValues;
  onChange: (field: keyof SoilValues, value: string) => void;
  disabled?: boolean;
  /** Nutrient inputs (pH, OM, N, P, K, moisture) are only editable once the
   *  field is enrolled in a started program. */
  showNutrients?: boolean;
  /** When given, the footer becomes a save action instead of a plain dismiss. */
  onSubmit?: () => void;
  submitLabel?: string;
  submitting?: boolean;
  subtitle?: string;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const SheetFooter: React.FC<{
  label: string;
  onPress: () => void;
  loading?: boolean;
}> = ({ label, onPress, loading }) => {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.footer, { paddingBottom: insets.bottom + spacing[4] }]}>
      <Button title={label} onPress={onPress} loading={loading} />
    </View>
  );
};

const SoilDetailsModal: React.FC<SoilDetailsModalProps> = ({
  visible,
  onClose,
  values,
  onChange,
  disabled = false,
  showNutrients = true,
  onSubmit,
  submitLabel,
  submitting = false,
  subtitle,
}) => {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const sheetHeight = Math.round(height * 0.9);

  const [mounted, setMounted] = useState(visible);
  const translateY = useSharedValue(height);
  const backdrop = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      translateY.value = height;
      backdrop.value = 0;
      setMounted(true);
    } else if (mounted) {
      backdrop.value = withTiming(0, BACKDROP_OUT_TIMING);
      translateY.value = withTiming(height, SHEET_CLOSE_TIMING, finished => {
        if (finished) {
          runOnJS(setMounted)(false);
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    if (mounted && visible) {
      backdrop.value = withTiming(1, BACKDROP_IN_TIMING);
      translateY.value = withSpring(0, SHEET_SPRING);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  const pan = Gesture.Pan()
    .onUpdate(e => {
      translateY.value = Math.max(0, e.translationY);
    })
    .onEnd(e => {
      const shouldClose =
        e.translationY > SHEET_DISMISS_DISTANCE || e.velocityY > SHEET_DISMISS_VELOCITY;
      if (shouldClose) {
        runOnJS(onClose)();
      } else {
        translateY.value = withSpring(0, SHEET_SPRING);
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }));

  const set = useCallback(
    (field: keyof SoilValues) => (value: string) => onChange(field, value),
    [onChange],
  );

  if (!mounted) {
    return null;
  }

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <SafeAreaProvider style={styles.flex}>
        <GestureHandlerRootView style={styles.root}>
        <AnimatedPressable
          style={[styles.backdrop, backdropStyle]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Dismiss soil details"
        />

        <View style={styles.anchor} pointerEvents="box-none">
          <Animated.View style={[styles.sheet, { height: sheetHeight }, sheetStyle]}>
            <GestureDetector gesture={pan}>
              <View style={styles.header}>
                <View style={styles.handle} />
                <View style={styles.headerRow}>
                  <View style={styles.headerLeft}>
                    <View style={styles.headerIcon}>
                      <AppIcon name={ICONS.SOIL} size={moderateScale(18)} color={COLORS.primary} />
                    </View>
                    <View style={styles.headerTexts}>
                      <AppText style={styles.title}>Soil Information</AppText>
                      <AppText style={styles.subtitle}>
                        {subtitle ?? "Optional — saved to the field's soil record"}
                      </AppText>
                    </View>
                  </View>
                  <Pressable
                    onPress={onClose}
                    hitSlop={HIT_SLOP}
                    accessibilityRole="button"
                    accessibilityLabel="Close"
                    style={styles.closeBtn}>
                    <AppIcon name={ICONS.CLOSE} size={moderateScale(20)} color={COLORS.gray700} />
                  </Pressable>
                </View>
              </View>
            </GestureDetector>

            <KeyboardAvoidingView
              style={styles.flex}
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              keyboardVerticalOffset={insets.top}>
              <ScrollView
                style={styles.flex}
                contentContainerStyle={styles.body}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}>
                <Input
                  label="Soil Texture"
                  placeholder="e.g. Loam  (optional)"
                  value={values.texture}
                  onChangeText={set('texture')}
                  editable={!disabled}
                  autoCapitalize="words"
                  returnKeyType="next"
                  maxLength={API_LIMITS.soil.texture}
                />

                {showNutrients ? (
                  <>
                  <View style={styles.row}>
                    <View style={styles.col}>
                      <Input
                        label="pH"
                        placeholder="e.g. 6.5"
                        value={values.ph}
                        onChangeText={set('ph')}
                        editable={!disabled}
                        keyboardType="decimal-pad"
                        returnKeyType="next"
                      />
                    </View>
                    <View style={styles.col}>
                      <Input
                        label="Organic Matter (%)"
                        placeholder="e.g. 3.2"
                        value={values.organicMatter}
                        onChangeText={set('organicMatter')}
                        editable={!disabled}
                        keyboardType="decimal-pad"
                        returnKeyType="next"
                      />
                    </View>
                  </View>

                  <View style={styles.row}>
                    <View style={styles.col}>
                      <Input
                        label="Nitrogen (N)"
                        placeholder="e.g. 40"
                        value={values.nitrogen}
                        onChangeText={set('nitrogen')}
                        editable={!disabled}
                        keyboardType="decimal-pad"
                        returnKeyType="next"
                      />
                    </View>
                    <View style={styles.col}>
                      <Input
                        label="Phosphorus (P)"
                        placeholder="e.g. 20"
                        value={values.phosphorus}
                        onChangeText={set('phosphorus')}
                        editable={!disabled}
                        keyboardType="decimal-pad"
                        returnKeyType="next"
                      />
                    </View>
                  </View>

                  <View style={styles.row}>
                    <View style={styles.col}>
                      <Input
                        label="Potassium (K)"
                        placeholder="e.g. 30"
                        value={values.potassium}
                        onChangeText={set('potassium')}
                        editable={!disabled}
                        keyboardType="decimal-pad"
                        returnKeyType="next"
                      />
                    </View>
                    <View style={styles.col}>
                      <Input
                        label="Moisture (%)"
                        placeholder="e.g. 18"
                        value={values.moisture}
                        onChangeText={set('moisture')}
                        editable={!disabled}
                        keyboardType="decimal-pad"
                        returnKeyType="next"
                      />
                    </View>
                  </View>
                  </>
                ) : null}

                <AppDatePicker
                  label="Soil Tested On"
                  value={values.testedOn || null}
                  onChange={set('testedOn')}
                  disabled={disabled}
                  maximumDate={MAX_DATE}
                />

                <Input
                  label="Soil Notes"
                  placeholder="Observations (optional)"
                  value={values.notes}
                  onChangeText={set('notes')}
                  editable={!disabled}
                  autoCapitalize="sentences"
                  returnKeyType="done"
                  maxLength={API_LIMITS.soil.notes}
                />
              </ScrollView>
            </KeyboardAvoidingView>

            <SheetFooter
              label={submitLabel ?? (disabled ? 'Close' : 'Done')}
              onPress={onSubmit ?? onClose}
              loading={submitting}
            />
          </Animated.View>
        </View>
        </GestureHandlerRootView>
      </SafeAreaProvider>
    </Modal>
  );
};

export default React.memo(SoilDetailsModal);

const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 } as const;
const MAX_DATE = new Date();

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.overlay,
  },
  anchor: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: borderRadius['2xl'],
    borderTopRightRadius: borderRadius['2xl'],
    overflow: 'hidden',
    ...shadows['2xl'],
  },
  header: {
    paddingTop: spacing[3],
    paddingBottom: spacing[3],
    paddingHorizontal: spacing[5],
    borderBottomWidth: borderWidth.hairline,
    borderBottomColor: COLORS.gray200,
  },
  handle: {
    alignSelf: 'center',
    width: scale(40),
    height: scale(4),
    borderRadius: borderRadius.full,
    backgroundColor: COLORS.gray300,
    marginBottom: spacing[3],
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  headerIcon: {
    width: scale(38),
    height: scale(38),
    borderRadius: borderRadius.md,
    backgroundColor: addAlpha(COLORS.primary, 0.1),
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTexts: {
    flex: 1,
  },
  title: {
    ...presets.headingSM,
    color: COLORS.gray900,
  },
  subtitle: {
    ...presets.caption,
    color: COLORS.gray500,
  },
  closeBtn: {
    width: scale(34),
    height: scale(34),
    borderRadius: borderRadius.full,
    backgroundColor: COLORS.gray100,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing[2],
  },
  body: {
    padding: spacing[4],
    paddingBottom: spacing[6],
  },
  row: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  col: {
    flex: 1,
  },
  footer: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3],
    borderTopWidth: borderWidth.hairline,
    borderTopColor: COLORS.gray200,
    backgroundColor: COLORS.white,
  },
});
