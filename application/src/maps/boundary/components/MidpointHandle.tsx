import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { COLORS } from '../../../constants';
import { scale } from '../../../utils';
import {
  MapMarker,
  type MarkerDragEvent,
  type MarkerDragStartEndEvent,
} from '../../components/MapPrimitives';
import type { LatLng } from '../../types';
import type { EdgeMidpoint } from '../types';

export interface MidpointHandleProps {
  midpoint: EdgeMidpoint;
  onPress: (edgeIndex: number, coordinate: LatLng) => void;
  onDragStart: (edgeIndex: number, edgeKey: string) => void;
  onDrag: (edgeIndex: number, point: LatLng) => void;
  onDragEnd: (edgeIndex: number, point: LatLng) => void;
}

const SETTLE_MS = 500;

const toLatLng = (
  event: MarkerDragEvent | MarkerDragStartEndEvent,
): LatLng => ({
  latitude: event.nativeEvent.coordinate.latitude,
  longitude: event.nativeEvent.coordinate.longitude,
});

const MidpointHandle: React.FC<MidpointHandleProps> = ({
  midpoint,
  onPress,
  onDragStart,
  onDrag,
  onDragEnd,
}) => {
  const [tracks, setTracks] = useState(true);

  useEffect(() => {
    setTracks(true);
    const timer = setTimeout(() => setTracks(false), SETTLE_MS);
    return () => clearTimeout(timer);
  }, []);

  const edgeKey = `${midpoint.fromId}>${midpoint.toId}`;

  return (
    <MapMarker
      coordinate={midpoint.coordinate}
      anchor={{ x: 0.5, y: 0.5 }}
      draggable
      tracksViewChanges={tracks}
      stopPropagation
      onPress={() => onPress(midpoint.edgeIndex, midpoint.coordinate)}
      onDragStart={() => onDragStart(midpoint.edgeIndex, edgeKey)}
      onDrag={event => onDrag(midpoint.edgeIndex, toLatLng(event))}
      onDragEnd={event => onDragEnd(midpoint.edgeIndex, toLatLng(event))}
      zIndex={4}>
      <View style={styles.hitbox}>
        <View style={styles.handle}>
          <View style={styles.plusH} />
          <View style={styles.plusV} />
        </View>
      </View>
    </MapMarker>
  );
};

export default React.memo(MidpointHandle);

const HIT = scale(40);
const HANDLE = scale(20);

const styles = StyleSheet.create({
  hitbox: {
    width: HIT,
    height: HIT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handle: {
    width: HANDLE,
    height: HANDLE,
    borderRadius: HANDLE / 2,
    backgroundColor: COLORS.validation,
    borderWidth: 2,
    borderColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusH: {
    position: 'absolute',
    width: scale(9),
    height: 2,
    borderRadius: 1,
    backgroundColor: COLORS.white,
  },
  plusV: {
    position: 'absolute',
    width: 2,
    height: scale(9),
    borderRadius: 1,
    backgroundColor: COLORS.white,
  },
});
