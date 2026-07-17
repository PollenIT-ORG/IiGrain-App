import React from 'react';
import { Platform, StatusBar, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../constants';

export interface AppStatusBarProps {
  color?: string;
  barStyle?: 'light-content' | 'dark-content';
}

const AppStatusBar: React.FC<AppStatusBarProps> = ({
  color = COLORS.primary,
  barStyle = 'light-content',
}) => {
  const insets = useSafeAreaInsets();
  const androidBar = Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0;
  const height = Math.max(insets.top, androidBar);
  return (
    <>
      <StatusBar translucent backgroundColor="transparent" barStyle={barStyle} />
      {height > 0 ? (
        <View style={[styles.strip, { height, backgroundColor: color }]} />
      ) : null}
    </>
  );
};

export default React.memo(AppStatusBar);

const styles = StyleSheet.create({
  strip: {
    width: '100%',
  },
});
