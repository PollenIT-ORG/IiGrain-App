import React, { useState } from 'react';
import {
  FlatList,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import AppText from '../AppText/AppText';
import { styles } from './AppDropdownStyle';

export interface DropdownOption {
  value: string;
  label: string;
}

export interface AppDropdownProps {
  label?: string;
  placeholder?: string;
  value: string | null;
  options: DropdownOption[];
  onSelect: (value: string) => void;
  error?: string;
  loading?: boolean;
  disabled?: boolean;
}

const AppDropdown: React.FC<AppDropdownProps> = ({
  label,
  placeholder = 'Select an option',
  value,
  options,
  onSelect,
  error,
  loading = false,
  disabled = false,
}) => {
  const [open, setOpen] = useState(false);

  const selected = options.find(option => option.value === value) ?? null;
  const hasError = !!error;
  const isDisabled = disabled || loading;

  const handleSelect = (next: string) => {
    onSelect(next);
    setOpen(false);
  };

  return (
    <View style={styles.group}>
      {label ? (
        <AppText style={[styles.label, hasError && styles.labelError]}>{label}</AppText>
      ) : null}

      <TouchableOpacity
        activeOpacity={0.8}
        disabled={isDisabled}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        style={[styles.field, hasError && styles.fieldError, isDisabled && styles.fieldDisabled]}>
        <AppText style={selected ? styles.valueText : styles.placeholderText} numberOfLines={1}>
          {loading ? 'Loading…' : selected ? selected.label : placeholder}
        </AppText>
        <AppText style={styles.caret}>▾</AppText>
      </TouchableOpacity>

      {hasError ? <AppText style={styles.helperError}>{error}</AppText> : null}

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableWithoutFeedback onPress={() => setOpen(false)}>
          <View style={styles.backdrop}>
            <TouchableWithoutFeedback>
              <View style={styles.sheet}>
                {label ? <AppText style={styles.sheetTitle}>{label}</AppText> : null}
                <FlatList
                  data={options}
                  keyExtractor={item => item.value}
                  renderItem={({ item }) => {
                    const active = item.value === value;
                    return (
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => handleSelect(item.value)}
                        style={[styles.option, active && styles.optionActive]}>
                        <AppText style={[styles.optionText, active && styles.optionTextActive]}>
                          {item.label}
                        </AppText>
                      </TouchableOpacity>
                    );
                  }}
                  ListEmptyComponent={<AppText style={styles.emptyText}>No options available</AppText>}
                />
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
};

export default AppDropdown;
