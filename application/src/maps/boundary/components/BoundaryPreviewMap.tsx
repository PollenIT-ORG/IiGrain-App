import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, type GestureResponderEvent } from 'react-native';
import AppMapView from '../../components/AppMapView';
import { useMapCamera } from '../../hooks/useMapCamera';
import type { LatLng, MapKind } from '../../types';
import BoundaryPolygon from './BoundaryPolygon';

export interface BoundaryPreviewMapProps {
  ring: readonly LatLng[];
  center: LatLng;
  mapKind?: MapKind;
  onTouchStart?: (e: GestureResponderEvent) => void;
  onTouchEnd?: (e: GestureResponderEvent) => void;
  onTouchCancel?: (e: GestureResponderEvent) => void;
}

const FIT_PADDING = { top: 28, right: 28, bottom: 28, left: 28 };

const BoundaryPreviewMap: React.FC<BoundaryPreviewMapProps> = ({
  ring,
  center,
  mapKind = 'hybrid',
  onTouchStart,
  onTouchEnd,
  onTouchCancel,
}) => {
  const { mapRef, onMapReady, isReady, camera } = useMapCamera();

  const fittedRef = useRef(false);
  useEffect(() => {
    if (!isReady || fittedRef.current || ring.length < 2) {
      return;
    }
    fittedRef.current = true;
    camera.fitToCoordinates(ring, FIT_PADDING);
  }, [isReady, ring, camera]);

  return (
    <View
      style={StyleSheet.absoluteFill}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchCancel}>
      <AppMapView
        ref={mapRef}
        onReady={onMapReady}
        mapKind={mapKind}
        initialCenter={center}
        initialZoom={16}
        style={StyleSheet.absoluteFill}>
        <BoundaryPolygon ring={ring} strokeWidth={3} />
      </AppMapView>
    </View>
  );
};

export default React.memo(BoundaryPreviewMap);
