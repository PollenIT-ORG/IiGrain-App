import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppIcon } from '../AppIcon';
import { borderRadius } from '../../constants';
import { addAlpha, moderateScale, scale } from '../../utils';

export interface FileTypeIconProps {
  icon: string;
  color: string;
  size?: number;
}

const FileTypeIcon: React.FC<FileTypeIconProps> = ({ icon, color, size = scale(46) }) => (
  <View
    style={[
      styles.tile,
      { width: size, height: size, backgroundColor: addAlpha(color, 0.12) },
    ]}>
    <AppIcon name={icon} size={moderateScale(24)} color={color} />
  </View>
);

export default React.memo(FileTypeIcon);

const styles = StyleSheet.create({
  tile: {
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
