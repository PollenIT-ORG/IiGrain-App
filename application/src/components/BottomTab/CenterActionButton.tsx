import React from 'react';
import { TouchableOpacity } from 'react-native';
import { COLORS } from '../../constants';
import { moderateScale } from '../../utils';
import { AppIcon, ICONS } from '../AppIcon';
import AppGradient from '../AppGradient/AppGradient';
import { styles } from './CenterActionButtonStyle';

interface CenterActionButtonProps {
  onPress: () => void;
  /** True while the Enroll tab is the focused route. */
  active?: boolean;
}

const CenterActionButton: React.FC<CenterActionButtonProps> = ({
  onPress,
  active = false,
}) => (
  <TouchableOpacity
    activeOpacity={0.88}
    onPress={onPress}
    accessibilityRole="button"
    accessibilityState={{ selected: active }}
    accessibilityLabel="Enroll now"
    style={styles.outer}>
    <AppGradient variant="fab" style={styles.gradient}>
      <AppIcon name={ICONS.PLUS} size={moderateScale(28)} color={COLORS.white} />
    </AppGradient>
  </TouchableOpacity>
);

export default CenterActionButton;
