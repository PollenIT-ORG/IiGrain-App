import React from 'react';
import { ShimmerProvider } from 'react-native-fast-shimmer';
import { SHIMMER_DURATION, SHIMMER_GRADIENT_CONFIG } from './shimmerTheme';

interface AppShimmerProviderProps {
  children?: React.ReactNode;
}

const AppShimmerProvider: React.FC<AppShimmerProviderProps> = ({ children }) => (
  <ShimmerProvider duration={SHIMMER_DURATION} gradientConfig={SHIMMER_GRADIENT_CONFIG}>
    {children}
  </ShimmerProvider>
);

export default AppShimmerProvider;
