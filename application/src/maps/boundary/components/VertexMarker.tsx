import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import AppText from '../../../components/AppText/AppText';
import { COLORS } from '../../../constants';
import { scale } from '../../../utils';
import {
  MapMarker,
  type MarkerDragEvent,
  type MarkerDragStartEndEvent,
} from '../../components/MapPrimitives';
import type { BoundaryVertex } from '../types';
import type { LatLng } from '../../types';

export interface VertexMarkerProps {
  vertex: BoundaryVertex;
  index: number;
  selected: boolean;
  isFirst: boolean;
  snapTarget: boolean;
  invalid: boolean;
  draggable: boolean;
  onPress: (id: string) => void;
  onDragStart: (id: string) => void;
  onDrag: (id: string, point: LatLng) => void;
  onDragEnd: (id: string, point: LatLng) => void;
}

const SETTLE_MS = 500;

const toLatLng = (
  event: MarkerDragEvent | MarkerDragStartEndEvent,
): LatLng => ({
  latitude: event.nativeEvent.coordinate.latitude,
  longitude: event.nativeEvent.coordinate.longitude,
});

const VertexMarker: React.FC<VertexMarkerProps> = ({
  vertex,
  index,
  selected,
  isFirst,
  snapTarget,
  invalid,
  draggable,
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
  }, [selected, snapTarget, invalid, isFirst, index]);

  return (
    <MapMarker
      coordinate={{ latitude: vertex.latitude, longitude: vertex.longitude }}
      anchor={{ x: 0.5, y: 0.5 }}
      draggable={draggable}
      tracksViewChanges={tracks}
      stopPropagation
      onPress={() => onPress(vertex.id)}
      onDragStart={() => onDragStart(vertex.id)}
      onDrag={event => onDrag(vertex.id, toLatLng(event))}
      onDragEnd={event => onDragEnd(vertex.id, toLatLng(event))}
      zIndex={selected || snapTarget ? 9 : 7}>
      <View style={styles.hitbox}>
        {selected || snapTarget ? (
          <View
            style={[
              styles.halo,
              snapTarget && styles.haloSnap,
              invalid && styles.haloDanger,
            ]}
          />
        ) : null}
        <View
          style={[
            styles.dot,
            isFirst && styles.dotFirst,
            selected && styles.dotSelected,
            snapTarget && styles.dotSnap,
            invalid && styles.dotDanger,
          ]}>
          <AppText style={styles.label}>{index + 1}</AppText>
        </View>
      </View>
    </MapMarker>
  );
};

export default React.memo(VertexMarker);

const HIT = scale(48);
const DOT = scale(26);
const DOT_SELECTED = scale(34);

const styles = StyleSheet.create({
  hitbox: {
    width: HIT,
    height: HIT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
    width: HIT,
    height: HIT,
    borderRadius: HIT / 2,
    backgroundColor: 'rgba(19,106,203,0.22)',
    borderWidth: 2,
    borderColor: COLORS.infoBlue,
  },
  haloSnap: {
    backgroundColor: 'rgba(22,122,69,0.25)',
    borderColor: COLORS.primary,
  },
  haloDanger: {
    backgroundColor: 'rgba(229,72,77,0.22)',
    borderColor: COLORS.danger,
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    backgroundColor: COLORS.primary,
    borderWidth: 2.5,
    borderColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotFirst: {
    backgroundColor: COLORS.primaryDark,
  },
  dotSelected: {
    width: DOT_SELECTED,
    height: DOT_SELECTED,
    borderRadius: DOT_SELECTED / 2,
    backgroundColor: COLORS.infoBlue,
    borderWidth: 3,
  },
  dotSnap: {
    backgroundColor: COLORS.primary,
    borderWidth: 3,
  },
  dotDanger: {
    backgroundColor: COLORS.danger,
  },
  label: {
    fontSize: scale(11),
    lineHeight: scale(14),
    fontWeight: '700',
    color: COLORS.white,
  },
});
