import React, { useCallback } from 'react';
import { Modal, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { COLORS } from '../../constants';
import type { LatLng } from '../types';
import LocationPicker, { type PickedLocation } from './LocationPicker';

export interface LocationPickerModalProps {
  visible: boolean;
  initial?: LatLng | null;
  onClose: () => void;
  onConfirm: (location: PickedLocation) => void;
  ring?: readonly LatLng[] | null;
  warnOutsideRing?: boolean;
  confirmLabel?: string;
  searchPlaceholder?: string;
}

const LocationPickerModal: React.FC<LocationPickerModalProps> = ({
  visible,
  initial = null,
  onClose,
  onConfirm,
  ring = null,
  warnOutsideRing = false,
  confirmLabel,
  searchPlaceholder,
}) => {
  const handleConfirm = useCallback(
    (location: PickedLocation) => {
      onConfirm(location);
      onClose();
    },
    [onConfirm, onClose],
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={onClose}>
      <SafeAreaProvider style={styles.root}>
        <LocationPicker
          initial={initial}
          onClose={onClose}
          onConfirm={handleConfirm}
          ring={ring}
          warnOutsideRing={warnOutsideRing}
          confirmLabel={confirmLabel}
          searchPlaceholder={searchPlaceholder}
        />
      </SafeAreaProvider>
    </Modal>
  );
};

export default React.memo(LocationPickerModal);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.white },
});
