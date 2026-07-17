import React from 'react';
import { Platform, StatusBar, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../constants';

const StatusBarBackground: React.FC = () => {
  const insets = useSafeAreaInsets();
  const androidBar = Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0;
  const height = Math.max(insets.top, androidBar);
  if (height <= 0) {
    return null;
  }
  return <View pointerEvents="none" style={[styles.fill, { height }]} />;
};

export default StatusBarBackground;

const styles = StyleSheet.create({
  fill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.primary,
    zIndex: 9999,
    elevation: 9999,
  },
});
