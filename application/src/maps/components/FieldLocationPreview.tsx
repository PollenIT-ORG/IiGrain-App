import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import { StyleSheet, View, type GestureResponderEvent } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { COLORS } from '../../constants';
import AppMapView from './AppMapView';
import { MapMarker } from './MapPrimitives';
import { MAP_ZOOM } from '../config/mapDefaults';
import { useMapCamera } from '../hooks/useMapCamera';
import { coordinatesKey } from '../utils/fieldCenter';
import type { LatLng, MapFocusHandle } from '../types';

export interface FieldLocationPreviewProps {
  latitude: number;
  longitude: number;
  zoom?: number;
  title?: string;
  onTouchStart?: (e: GestureResponderEvent) => void;
  onTouchEnd?: (e: GestureResponderEvent) => void;
  onTouchCancel?: (e: GestureResponderEvent) => void;
  children?: React.ReactNode;
}

const FOCUS_ANIMATION_MS = 450;

const FieldLocationPreview = forwardRef<MapFocusHandle, FieldLocationPreviewProps>(
  (
    {
      latitude,
      longitude,
      zoom = MAP_ZOOM.PLACE,
      title,
      onTouchStart,
      onTouchEnd,
      onTouchCancel,
      children,
    },
    ref,
  ) => {
    const coordinate = useMemo<LatLng>(
      () => ({ latitude, longitude }),
      [latitude, longitude],
    );

    const { mapRef, onMapReady, isReady, camera } = useMapCamera();
    const isFocused = useIsFocused();

    const centerKey = coordinatesKey([coordinate]);
    const lastCenteredRef = useRef('');
    useEffect(() => {
      if (!isReady || !isFocused || !centerKey || lastCenteredRef.current === centerKey) {
        return;
      }
      lastCenteredRef.current = centerKey;
      camera.setCoordinate(coordinate, zoom);
    }, [isReady, isFocused, centerKey, coordinate, zoom, camera]);

    const focusPin = useCallback(() => {
      camera.animateToCoordinate(coordinate, zoom, FOCUS_ANIMATION_MS);
    }, [camera, coordinate, zoom]);

    useImperativeHandle(ref, () => ({ focus: focusPin }), [focusPin]);

    return (
      <View
        style={styles.wrap}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchCancel}>
        <AppMapView
          ref={mapRef}
          onReady={onMapReady}
          initialCenter={coordinate}
          initialZoom={zoom}
          styleVariant="preview"
          style={styles.map}>
          <MapMarker
            coordinate={coordinate}
            title={title}
            pinColor={COLORS.primary}
            tracksViewChanges={false}
          />
          {children}
        </AppMapView>
      </View>
    );
  },
);

FieldLocationPreview.displayName = 'FieldLocationPreview';

export default React.memo(FieldLocationPreview);

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  map: { flex: 1 },
});
