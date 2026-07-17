import React from 'react';
import { Image, View } from 'react-native';
import { IMAGES } from '../../assets/images';
import AppText from '../AppText/AppText';
import { styles } from './AuthHeaderStyle';

export interface AuthHeaderProps {
  showLogo?: boolean;
  title?: string;
  subtitle?: string;
}

const AuthHeader: React.FC<AuthHeaderProps> = ({
  showLogo = true,
  title,
  subtitle,
}) => {
  return (
    <View style={styles.container}>
      {showLogo ? (
        <Image source={IMAGES.logo} style={styles.logo} resizeMode="contain" />
      ) : null}
      {title ? <AppText style={styles.title}>{title}</AppText> : null}
      {subtitle ? <AppText style={styles.subtitle}>{subtitle}</AppText> : null}
    </View>
  );
};

export default AuthHeader;
