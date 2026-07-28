import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Keyboard,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon } from '../AppIcon';
import { COLORS, spacing } from '../../constants';
import { moderateScale, scale } from '../../utils';
import AppText from '../AppText/AppText';
import { styles } from './AppMonthPickerStyle';

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 } as const;
const SHEET_TRAVEL = scale(420);

const pad2 = (n: number): string => (n < 10 ? `0${n}` : `${n}`);

export interface YearMonth {
  year: number;
  month: number;
}

/** Stored as a plain YYYY-MM-DD date (first of the month) so the existing
 *  backend date contract keeps working unchanged. */
export const toISOMonth = ({ year, month }: YearMonth): string =>
  `${year}-${pad2(month + 1)}-01`;

export const parseISOMonth = (value?: string | null): YearMonth | null => {
  if (!value) {
    return null;
  }
  const match = /^(\d{4})-(\d{2})/.exec(value.trim());
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  if (!Number.isFinite(year) || month < 0 || month > 11) {
    return null;
  }
  return { year, month };
};

const ordinal = ({ year, month }: YearMonth): number => year * 12 + month;

const formatDisplay = ({ year, month }: YearMonth): string => `${MONTHS[month]} ${year}`;

export interface AppMonthPickerProps {
  label?: string;
  value: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  /** Months earlier than this are not selectable (YYYY-MM-DD). */
  minMonth?: string | null;
  /** Months later than this are not selectable (YYYY-MM-DD). */
  maxMonth?: string | null;
  icon?: string;
}

const AppMonthPicker: React.FC<AppMonthPickerProps> = ({
  label,
  value,
  onChange,
  placeholder = 'Select month',
  error,
  disabled = false,
  minMonth,
  maxMonth,
  icon = 'calendar-month-outline',
}) => {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);

  const selected = useMemo(() => parseISOMonth(value), [value]);
  const min = useMemo(() => parseISOMonth(minMonth), [minMonth]);
  const max = useMemo(() => parseISOMonth(maxMonth), [maxMonth]);
  const hasError = !!error;

  const [year, setYear] = useState<number>(
    () => selected?.year ?? new Date().getFullYear(),
  );

  const translateY = useRef(new Animated.Value(SHEET_TRAVEL)).current;
  const backdrop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!open) {
      return;
    }
    setYear(selected?.year ?? new Date().getFullYear());
    translateY.setValue(SHEET_TRAVEL);
    Animated.parallel([
      Animated.timing(backdrop, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        damping: 24,
        stiffness: 240,
        mass: 0.9,
      }),
    ]).start();
  }, [open, selected, translateY, backdrop]);

  const closeSheet = useCallback(() => {
    Animated.parallel([
      Animated.timing(backdrop, { toValue: 0, duration: 160, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: SHEET_TRAVEL, duration: 180, useNativeDriver: true }),
    ]).start(() => setOpen(false));
  }, [backdrop, translateY]);

  const handlePress = useCallback(() => {
    if (disabled) {
      return;
    }
    Keyboard.dismiss();
    setOpen(true);
  }, [disabled]);

  const isMonthDisabled = useCallback(
    (monthIndex: number): boolean => {
      const current = ordinal({ year, month: monthIndex });
      if (min && current < ordinal(min)) {
        return true;
      }
      if (max && current > ordinal(max)) {
        return true;
      }
      return false;
    },
    [year, min, max],
  );

  const pickMonth = useCallback(
    (monthIndex: number) => {
      onChange(toISOMonth({ year, month: monthIndex }));
      closeSheet();
    },
    [onChange, year, closeSheet],
  );

  return (
    <View style={styles.group}>
      {label ? (
        <AppText style={[styles.label, hasError && styles.labelError]}>{label}</AppText>
      ) : null}

      <Pressable
        onPress={handlePress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        accessibilityLabel={
          label
            ? `${label}, ${selected ? formatDisplay(selected) : 'no month selected'}`
            : undefined
        }
        style={({ pressed }) => [
          styles.field,
          hasError && styles.fieldError,
          disabled && styles.fieldDisabled,
          pressed && !disabled && styles.fieldPressed,
        ]}>
        <AppText
          style={selected ? styles.valueText : styles.placeholderText}
          numberOfLines={1}>
          {selected ? formatDisplay(selected) : placeholder}
        </AppText>
        <AppIcon
          name={icon}
          size={moderateScale(20)}
          color={hasError ? COLORS.danger : COLORS.gray500}
        />
      </Pressable>

      {hasError ? <AppText style={styles.helperError}>{error}</AppText> : null}

      <Modal visible={open} transparent animationType="none" onRequestClose={closeSheet}>
        <Animated.View style={[styles.backdrop, { opacity: backdrop }]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            accessibilityLabel="Dismiss month picker"
            onPress={closeSheet}
          />
        </Animated.View>

        <View style={styles.sheetContainer} pointerEvents="box-none">
          <Animated.View
            style={[
              styles.sheet,
              { paddingBottom: insets.bottom + spacing[3], transform: [{ translateY }] },
            ]}>
            <View style={styles.grabber} />

            <View style={styles.sheetHeader}>
              <Pressable hitSlop={HIT_SLOP} onPress={closeSheet} accessibilityRole="button">
                <AppText style={styles.cancel}>Cancel</AppText>
              </Pressable>
              <AppText style={styles.sheetTitle} numberOfLines={1}>
                {label ?? 'Select Month'}
              </AppText>
              <View style={styles.headerSpacer} />
            </View>

            <View style={styles.yearRow}>
              <Pressable
                onPress={() => setYear(y => y - 1)}
                hitSlop={HIT_SLOP}
                accessibilityRole="button"
                accessibilityLabel="Previous year"
                style={styles.yearBtn}>
                <AppIcon
                  name="chevron-left"
                  size={moderateScale(24)}
                  color={COLORS.primary}
                />
              </Pressable>
              <AppText style={styles.yearText}>{year}</AppText>
              <Pressable
                onPress={() => setYear(y => y + 1)}
                hitSlop={HIT_SLOP}
                accessibilityRole="button"
                accessibilityLabel="Next year"
                style={styles.yearBtn}>
                <AppIcon
                  name="chevron-right"
                  size={moderateScale(24)}
                  color={COLORS.primary}
                />
              </Pressable>
            </View>

            <View style={styles.grid}>
              {MONTHS.map((m, i) => {
                const isSelected =
                  !!selected && selected.year === year && selected.month === i;
                const monthDisabled = isMonthDisabled(i);
                return (
                  <Pressable
                    key={m}
                    onPress={() => pickMonth(i)}
                    disabled={monthDisabled}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected, disabled: monthDisabled }}
                    accessibilityLabel={`${m} ${year}`}
                    style={({ pressed }) => [
                      styles.monthChip,
                      isSelected && styles.monthChipSelected,
                      monthDisabled && styles.monthChipDisabled,
                      pressed && !monthDisabled && !isSelected && styles.monthChipPressed,
                    ]}>
                    <AppText
                      style={[
                        styles.monthText,
                        isSelected && styles.monthTextSelected,
                        monthDisabled && styles.monthTextDisabled,
                      ]}>
                      {m}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
};

export default React.memo(AppMonthPicker);
