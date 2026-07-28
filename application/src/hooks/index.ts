export { useDebouncedValue } from './useDebouncedValue';
export { useFormValidation } from './useFormValidation';
export type {
  UseFormValidation,
  ValidatorMap,
  FormErrors,
} from './useFormValidation';

import { useState, useEffect } from 'react';
import { Dimensions, ScaledSize } from 'react-native';

interface DeviceInfo {
  width: number;
  height: number;
  isTablet: boolean;
  isPortrait: boolean;
  isLandscape: boolean;
}

export const useDevice = (): DeviceInfo => {
  const [dims, setDims] = useState<ScaledSize>(Dimensions.get('window'));

  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => {
      setDims(window);
    });
    return () => sub?.remove();
  }, []);

  const { width, height } = dims;

  return {
    width,
    height,
    isTablet:    width >= 768,
    isPortrait:  height >= width,
    isLandscape: width > height,
  };
};
