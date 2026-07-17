import React from 'react';
import { StyleSheet, View } from 'react-native';
import LottieView from 'lottie-react-native';
import AppText from '../AppText/AppText';
import Button from '../Button/Button';
import { COLORS, presets, spacing } from '../../constants';
import { scale } from '../../utils';
import { FARMER_LOTTIE } from '../../assets/images/lottie';

export interface FarmerEmptyStateProps {
  title: string;
  message: string;
  actionLabel: string;
  onAction: () => void;
}

const FarmerEmptyState: React.FC<FarmerEmptyStateProps> = ({
  title,
  message,
  actionLabel,
  onAction,
}) => (
  <View style={styles.wrap}>
    <LottieView
      source={FARMER_LOTTIE}
      autoPlay
      loop
      resizeMode="contain"
      style={styles.lottie}
    />
    <AppText style={styles.title}>{title}</AppText>
    <AppText style={styles.message}>{message}</AppText>
    <Button title={actionLabel} onPress={onAction} fullWidth={false} style={styles.button} />
  </View>
);

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[6],
    paddingTop: spacing[8],
  },
  lottie: {
    width: scale(260),
    height: scale(260),
  },
  title: {
    ...presets.headingSM,
    color: COLORS.gray900,
    textAlign: 'center',
    marginTop: spacing[2],
  },
  message: {
    ...presets.bodySM,
    color: COLORS.gray600,
    textAlign: 'center',
    marginTop: spacing[2],
    maxWidth: scale(300),
  },
  button: {
    minWidth: scale(220),
    marginTop: spacing[7],
  },
});

export default FarmerEmptyState;
