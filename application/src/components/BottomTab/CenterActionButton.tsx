import React from 'react';
import { TouchableOpacity } from 'react-native';
import { COLORS } from '../../constants';
import { moderateScale } from '../../utils';
import { AppIcon, ICONS } from '../AppIcon';
import AppGradient from '../AppGradient/AppGradient';
import { styles } from './CenterActionButtonStyle';

interface CenterActionButtonProps {
  onPress: () => void;
}

const CenterActionButton: React.FC<CenterActionButtonProps> = ({ onPress }) => (
  <TouchableOpacity
    activeOpacity={0.88}
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel="Enroll now"
    style={styles.outer}>
    <AppGradient variant="fab" style={styles.gradient}>
      <AppIcon name={ICONS.PLUS} size={moderateScale(28)} color={COLORS.white} />
    </AppGradient>
  </TouchableOpacity>
);

export default CenterActionButton;
