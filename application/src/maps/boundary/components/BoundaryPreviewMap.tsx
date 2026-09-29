import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import { StyleSheet, View, type GestureResponderEvent } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import AppMapView from '../../components/AppMapView';
import { useMapCamera } from '../../hooks/useMapCamera';
import { coordinatesKey } from '../../utils/fieldCenter';
import type { LatLng, MapFocusHandle, MapKind } from '../../types';
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

const BoundaryPreviewMap = forwardRef<MapFocusHandle, BoundaryPreviewMapProps>(
  ({ ring, center, mapKind = 'hybrid', onTouchStart, onTouchEnd, onTouchCancel }, ref) => {
    const { mapRef, onMapReady, isReady, camera } = useMapCamera();
    const isFocused = useIsFocused();

    const fitKey = coordinatesKey(ring);
    const lastFitRef = useRef('');

    const fitToRing = useCallback(() => {
      if (ring.length >= 2) {
        camera.fitToCoordinates(ring, FIT_PADDING);
      }
    }, [ring, camera]);

    useEffect(() => {
      if (!isReady || !isFocused || ring.length < 2 || lastFitRef.current === fitKey) {
        return;
      }
      lastFitRef.current = fitKey;
      fitToRing();
    }, [isReady, isFocused, fitKey, ring.length, fitToRing]);

    useImperativeHandle(ref, () => ({ focus: fitToRing }), [fitToRing]);

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
          <BoundaryPolygon key={fitKey} ring={ring} strokeWidth={3} />
        </AppMapView>
      </View>
    );
  },
);

BoundaryPreviewMap.displayName = 'BoundaryPreviewMap';

export default React.memo(BoundaryPreviewMap);
