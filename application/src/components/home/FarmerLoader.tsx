import React from 'react';
import { StyleSheet, View } from 'react-native';
import LottieView from 'lottie-react-native';
import AppText from '../AppText/AppText';
import { COLORS, presets, spacing } from '../../constants';
import { scale } from '../../utils';
import { FARMER_LOTTIE } from '../../assets/images/lottie';

export interface FarmerLoaderProps {
  message?: string;
}

const FarmerLoader: React.FC<FarmerLoaderProps> = ({
  message = 'Preparing your dashboard…',
}) => (
  <View style={styles.wrap}>
    <LottieView
      source={FARMER_LOTTIE}
      autoPlay
      loop
      resizeMode="contain"
      style={styles.lottie}
    />
    <AppText style={styles.message}>{message}</AppText>
  </View>
);

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[6],
  },
  lottie: {
    width: scale(260),
    height: scale(260),
  },
  message: {
    ...presets.labelLG,
    color: COLORS.gray600,
    textAlign: 'center',
    marginTop: spacing[4],
  },
});

export default FarmerLoader;
