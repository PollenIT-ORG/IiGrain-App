/**
 * src/maps/components/LocationPickerModal.tsx — LocationPicker as a full-screen
 * modal.
 *
 * WHY IT IS A SEPARATE COMPONENT
 * ------------------------------
 * Two of the three call sites (AddFarm, AddField) need the picker to appear
 * over a form without a navigation push — pushing a route would unmount the
 * half-filled form on some navigators and lose the user's input. The third
 * (a full-screen picker route) wants the bare picker. Splitting presentation
 * from the picker itself keeps both honest.
 *
 * WHY `SafeAreaProvider` IS RE-DECLARED INSIDE
 * A native `<Modal>` renders in its own window on both platforms, outside the
 * React tree that carries the app's safe-area context. Without a provider here,
 * `useSafeAreaInsets()` inside the picker returns zeroes and the search bar
 * slides under the status bar / notch.
 *
 * Migrated from `src/components/location/LocationPickerModal.tsx`; the only
 * change is where `LocationPicker` is imported from.
 */

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
}

const LocationPickerModal: React.FC<LocationPickerModalProps> = ({
  visible,
  initial = null,
  onClose,
  onConfirm,
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
        <LocationPicker initial={initial} onClose={onClose} onConfirm={handleConfirm} />
      </SafeAreaProvider>
    </Modal>
  );
};

export default React.memo(LocationPickerModal);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.white },
});
