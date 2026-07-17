import type { StyleProp, TextStyle } from 'react-native';
import type { IconName } from './iconRegistry';
import type { IconSizeToken } from './constants';

export interface AppIconProps {
  name: IconName | (string & {});
  size?: IconSizeToken | number;
  color?: string;
  strokeWidth?: number;
  filled?: boolean;
  disabled?: boolean;
  opacity?: number;
  rotation?: number;
  style?: StyleProp<TextStyle>;
  testID?: string;
  accessibilityLabel?: string;
  accessibilityRole?: 'image' | 'button' | 'none';
  animated?: boolean;
}
