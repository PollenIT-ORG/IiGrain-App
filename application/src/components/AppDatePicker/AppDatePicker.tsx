import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon } from '../AppIcon';
import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { COLORS, spacing } from '../../constants';
import { moderateScale, scale } from '../../utils';
import AppText from '../AppText/AppText';
import { styles } from './AppDatePickerStyle';

const isIOS = Platform.OS === 'ios';

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 } as const;

const SHEET_TRAVEL = scale(460);

const pad2 = (n: number): string => (n < 10 ? `0${n}` : `${n}`);

export const toISODate = (date: Date): string =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

export const parseISODate = (value?: string | null): Date | null => {
  if (!value) {
    return null;
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) {
    return null;
  }
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDisplay = (date: Date): string =>
  `${pad2(date.getDate())} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;

export interface AppDatePickerProps {
  label?: string;
  value: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  minimumDate?: Date;
  maximumDate?: Date;
  icon?: string;
}

const AppDatePicker: React.FC<AppDatePickerProps> = ({
  label,
  value,
  onChange,
  placeholder = 'Select date',
  error,
  disabled = false,
  minimumDate,
  maximumDate,
  icon = 'calendar-blank-outline',
}) => {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(() => parseISODate(value) ?? new Date());

  const translateY = useRef(new Animated.Value(SHEET_TRAVEL)).current;
  const backdrop = useRef(new Animated.Value(0)).current;

  const selectedDate = useMemo(() => parseISODate(value), [value]);
  const hasError = !!error;

  const resolveInitial = useCallback((): Date => {
    const parsed = parseISODate(value);
    if (parsed) {
      return parsed;
    }
    let today = new Date();
    if (minimumDate && today < minimumDate) {
      today = minimumDate;
    }
    if (maximumDate && today > maximumDate) {
      today = maximumDate;
    }
    return today;
  }, [value, minimumDate, maximumDate]);

  useEffect(() => {
    if (!open) {
      return;
    }
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
  }, [open, translateY, backdrop]);

  const closeSheet = useCallback(() => {
    Animated.parallel([
      Animated.timing(backdrop, { toValue: 0, duration: 160, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: SHEET_TRAVEL, duration: 180, useNativeDriver: true }),
    ]).start(() => setOpen(false));
  }, [backdrop, translateY]);

  const openAndroid = useCallback(() => {
    DateTimePickerAndroid.open({
      value: resolveInitial(),
      mode: 'date',
      display: 'calendar',
      minimumDate,
      maximumDate,
      onChange: (event: DateTimePickerEvent, date?: Date) => {
        if (event.type === 'set' && date) {
          onChange(toISODate(date));
        }
      },
    });
  }, [resolveInitial, minimumDate, maximumDate, onChange]);

  const handlePress = useCallback(() => {
    if (disabled) {
      return;
    }
    Keyboard.dismiss();
    if (isIOS) {
      setTempDate(resolveInitial());
      setOpen(true);
    } else {
      openAndroid();
    }
  }, [disabled, resolveInitial, openAndroid]);

  const onIOSChange = useCallback((_event: DateTimePickerEvent, date?: Date) => {
    if (date) {
      setTempDate(date);
    }
  }, []);

  const confirmIOS = useCallback(() => {
    onChange(toISODate(tempDate));
    closeSheet();
  }, [onChange, tempDate, closeSheet]);

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
            ? `${label}, ${selectedDate ? formatDisplay(selectedDate) : 'no date selected'}`
            : undefined
        }
        style={({ pressed }) => [
          styles.field,
          hasError && styles.fieldError,
          disabled && styles.fieldDisabled,
          pressed && !disabled && styles.fieldPressed,
        ]}>
        <AppText
          style={selectedDate ? styles.valueText : styles.placeholderText}
          numberOfLines={1}>
          {selectedDate ? formatDisplay(selectedDate) : placeholder}
        </AppText>
        <AppIcon
          name={icon}
          size={moderateScale(20)}
          color={hasError ? COLORS.danger : COLORS.gray500}
        />
      </Pressable>

      {hasError ? <AppText style={styles.helperError}>{error}</AppText> : null}

      {isIOS ? (
        <Modal visible={open} transparent animationType="none" onRequestClose={closeSheet}>
          <Animated.View style={[styles.backdrop, { opacity: backdrop }]}>
            <Pressable
              style={StyleSheet.absoluteFill}
              accessibilityLabel="Dismiss date picker"
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
                  {label ?? 'Select Date'}
                </AppText>
                <Pressable hitSlop={HIT_SLOP} onPress={confirmIOS} accessibilityRole="button">
                  <AppText style={styles.done}>Done</AppText>
                </Pressable>
              </View>

              <DateTimePicker
                value={tempDate}
                mode="date"
                display="inline"
                themeVariant="light"
                accentColor={COLORS.primary}
                minimumDate={minimumDate}
                maximumDate={maximumDate}
                onChange={onIOSChange}
                style={styles.iosPicker}
              />
            </Animated.View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
};

export default React.memo(AppDatePicker);
