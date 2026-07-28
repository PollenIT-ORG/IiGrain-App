/**
 * src/maps/boundary/components/VertexHandle.tsx — one draggable boundary vertex.
 *
 * A `<MapMarker>` with a custom circular handle. Draggable; reports the new
 * position only on release (`onDragEnd`) so a whole drag is one undo step, not
 * one-per-frame (DRAWING_ENGINE §4).
 *
 * PERFORMANCE: `tracksViewChanges` must be false once the handle has rasterised,
 * or every frame re-uploads the bitmap and a multi-vertex ring janks. It starts
 * true for one settle window (Android renders an empty square otherwise), then
 * latches false — the module's standing marker rule (VisitMap reference).
 */

import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { COLORS } from '../../../constants';
import { scale } from '../../../utils';
import {
  MapMarker,
  type MarkerDragStartEndEvent,
} from '../../components/MapPrimitives';
import type { LatLng } from '../../types';

export interface VertexHandleProps {
  index: number;
  coordinate: LatLng;
  selected: boolean;
  /** Live position during a drag (for edge preview); optional. */
  onDrag?: (index: number, point: LatLng) => void;
  /** Committed position on release — the undo-recorded move. */
  onDragEnd: (index: number, point: LatLng) => void;
  onPress: (index: number) => void;
}

const SETTLE_MS = 600;

const toLatLng = (e: MarkerDragStartEndEvent): LatLng => ({
  latitude: e.nativeEvent.coordinate.latitude,
  longitude: e.nativeEvent.coordinate.longitude,
});

const VertexHandle: React.FC<VertexHandleProps> = ({
  index,
  coordinate,
  selected,
  onDrag,
  onDragEnd,
  onPress,
}) => {
  // Latches false after the first settle window so the bitmap stops re-uploading.
  const [tracks, setTracks] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setTracks(false), SETTLE_MS);
    return () => clearTimeout(timer);
  }, []);
  // A selected handle changes size/colour, so let it re-rasterise once.
  useEffect(() => {
    setTracks(true);
    const timer = setTimeout(() => setTracks(false), SETTLE_MS);
    return () => clearTimeout(timer);
  }, [selected]);

  return (
    <MapMarker
      coordinate={coordinate}
      // The visible dot sits at the coordinate; the finger rests below it, so
      // the point being placed is never hidden (Trimble/DJI pattern).
      anchor={{ x: 0.5, y: 0.5 }}
      draggable
      tracksViewChanges={tracks}
      onPress={() => onPress(index)}
      onDrag={onDrag ? e => onDrag(index, toLatLng(e)) : undefined}
      onDragEnd={e => onDragEnd(index, toLatLng(e))}
      zIndex={selected ? 3 : 2}>
      <View style={styles.hitbox}>
        <View style={[styles.handle, selected && styles.handleSelected]} />
      </View>
    </MapMarker>
  );
};

export default React.memo(VertexHandle);

const styles = StyleSheet.create({
  // Larger than the dot so the touch target is generous without a huge visual.
  hitbox: {
    width: scale(30),
    height: scale(30),
    alignItems: 'center',
    justifyContent: 'center',
  },
  handle: {
    width: scale(16),
    height: scale(16),
    borderRadius: scale(8),
    backgroundColor: COLORS.white,
    borderWidth: 3,
    borderColor: COLORS.primary,
  },
  handleSelected: {
    width: scale(22),
    height: scale(22),
    borderRadius: scale(11),
    borderColor: COLORS.secondary,
    backgroundColor: COLORS.secondary,
  },
});
