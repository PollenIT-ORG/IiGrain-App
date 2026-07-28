import React, { memo, useCallback } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { AppIcon } from '../AppIcon';
import AppTextInput from '../AppTextInput/AppTextInput';
import { COLORS } from '../../constants';
import { moderateScale } from '../../utils';
import { styles } from './SearchBarStyle';

export interface SearchBarProps {
  value: string;
  onChangeText: (next: string) => void;
  placeholder?: string;
  style?: StyleProp<ViewStyle>;
  autoFocus?: boolean;
}

const HIT_SLOP = { top: 8, right: 8, bottom: 8, left: 8 } as const;

const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChangeText,
  placeholder = 'Search',
  style,
  autoFocus,
}) => {
  const clear = useCallback(() => onChangeText(''), [onChangeText]);

  return (
    <View style={[styles.box, style]}>
      <AppIcon name="magnify" size={moderateScale(18)} color={COLORS.gray500} />
      <AppTextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={COLORS.gray500}
        value={value}
        onChangeText={onChangeText}
        returnKeyType="search"
        autoCorrect={false}
        autoCapitalize="none"
        autoFocus={autoFocus}
      />
      {value.length > 0 ? (
        <Pressable
          onPress={clear}
          hitSlop={HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel="Clear search">
          <AppIcon name="close-circle" size={moderateScale(18)} color={COLORS.gray500} />
        </Pressable>
      ) : null}
    </View>
  );
};

export default memo(SearchBar);
