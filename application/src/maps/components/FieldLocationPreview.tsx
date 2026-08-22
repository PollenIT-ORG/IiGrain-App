import React, { useMemo } from 'react';
import { StyleSheet, View, type GestureResponderEvent } from 'react-native';
import { COLORS } from '../../constants';
import AppMapView from './AppMapView';
import { MapMarker } from './MapPrimitives';
import { MAP_ZOOM } from '../config/mapDefaults';
import type { LatLng } from '../types';

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

const FieldLocationPreview: React.FC<FieldLocationPreviewProps> = ({
  latitude,
  longitude,
  zoom = MAP_ZOOM.PLACE,
  title,
  onTouchStart,
  onTouchEnd,
  onTouchCancel,
  children,
}) => {
  const coordinate = useMemo<LatLng>(
    () => ({ latitude, longitude }),
    [latitude, longitude],
  );

  return (
    <View
      style={styles.wrap}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchCancel}>
      <AppMapView
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
};

export default React.memo(FieldLocationPreview);

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  map: { flex: 1 },
});
