/**
 * src/maps/boundary/components/MidpointHandle.tsx — a "ghost" insert handle at
 * an edge midpoint.
 *
 * Tapping it inserts a real vertex splitting that edge (DRAWING_ENGINE §4). The
 * screen renders these only when zoomed in enough that edges are long on screen
 * — otherwise a many-vertex ring would mount an equal number of ghost markers
 * (perf + clutter).
 *
 * Rendered smaller and translucent so it reads as "add here", not as an existing
 * vertex.
 */

import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { COLORS } from '../../../constants';
import { addAlpha, scale } from '../../../utils';
import { MapMarker } from '../../components/MapPrimitives';
import type { LatLng } from '../../types';

export interface MidpointHandleProps {
  /** Index of the edge this midpoint splits (insert goes after this vertex). */
  edgeIndex: number;
  coordinate: LatLng;
  onPress: (edgeIndex: number, coordinate: LatLng) => void;
}

const SETTLE_MS = 600;

const MidpointHandle: React.FC<MidpointHandleProps> = ({
  edgeIndex,
  coordinate,
  onPress,
}) => {
  const [tracks, setTracks] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setTracks(false), SETTLE_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <MapMarker
      coordinate={coordinate}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={tracks}
      onPress={() => onPress(edgeIndex, coordinate)}
      zIndex={1}>
      <View style={styles.hitbox}>
        <View style={styles.ghost} />
      </View>
    </MapMarker>
  );
};

export default React.memo(MidpointHandle);

const styles = StyleSheet.create({
  hitbox: {
    width: scale(26),
    height: scale(26),
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghost: {
    width: scale(12),
    height: scale(12),
    borderRadius: scale(6),
    backgroundColor: addAlpha(COLORS.white, 0.7),
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
});
