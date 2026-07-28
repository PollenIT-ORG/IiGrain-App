/**
 * src/maps/components/FieldLocationPreview.tsx — small read-only map showing
 * where a field is.
 *
 * Migrated from `src/components/location/FieldLocationPreview.tsx` (Leaflet in a
 * WebView). Same props, same behaviour, native renderer.
 *
 * WHY IT KEEPS THE TOUCH CALLBACKS
 * --------------------------------
 * This map is embedded inside FieldDetailsScreen's vertical ScrollView. Two
 * scrollable surfaces stacked on the same axis fight for the pan gesture: drag
 * the map and the page scrolls instead, or vice versa. The screen resolves that
 * by freezing its own scroll while a finger is down on the map, which needs
 * these three callbacks. They are forwarded to the WRAPPER view rather than to
 * the native map, because on iOS the map's own gesture recogniser consumes the
 * events before React Native's responder system sees them.
 *
 * WHY IT SHOWS A MARKER RATHER THAN A CENTRE PIN
 * Unlike the picker, this map is not selecting anything — the coordinate is
 * already decided. A real `<Marker>` moves with the map, which is the correct
 * semantics for "the field is *there*", and keeps working if the user pans away
 * to get their bearings.
 */

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
  /** Google zoom level. Defaults to neighbourhood scale. */
  zoom?: number;
  /** Optional label shown in the marker's callout when tapped. */
  title?: string;
  /** Forwarded to the wrapper so a parent ScrollView can freeze/unfreeze while
   *  the user pans the map. */
  onTouchStart?: (e: GestureResponderEvent) => void;
  onTouchEnd?: (e: GestureResponderEvent) => void;
  onTouchCancel?: (e: GestureResponderEvent) => void;
  /** Optional map children — e.g. a field's saved boundary polygon overlaid on
   *  the preview. Rendered inside the map surface. */
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
        // Road labels are dropped at this size — see mapStyle.ts.
        styleVariant="preview"
        style={styles.map}>
        <MapMarker
          coordinate={coordinate}
          title={title}
          pinColor={COLORS.primary}
          // Static marker on a static map: telling the SDK the marker's bitmap
          // never changes lets it cache the texture instead of re-rasterising
          // it on every frame. This is the single biggest cost of embedding a
          // map in a scrolling list on Android.
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
