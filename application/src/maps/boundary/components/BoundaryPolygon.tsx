import React, { useRef } from 'react';
import { Platform } from 'react-native';
import { COLORS } from '../../../constants';
import { addAlpha } from '../../../utils';
import { MapPolygon } from '../../components/MapPrimitives';
import type { LatLng } from '../../types';

export interface BoundaryPolygonProps {
  ring: readonly LatLng[];
  invalid?: boolean;
  color?: string;
  strokeWidth?: number;
  tappable?: boolean;
  onPress?: () => void;
}

/**
 * iOS only. react-native-maps 1.29's Fabric polygon rebuilds its `GMSMutablePath`
 * **only when the number of coordinates changes**:
 *
 *   if (newViewProps.coordinates.size() != oldViewProps.coordinates.size()) { … }
 *   — ios/AirGoogleMaps/RNMapsGooglePolygonView.mm
 *
 * Dragging a vertex keeps the count identical, so the shape freezes at whatever
 * it was when a point was last added or removed: drawing looks fine, editing
 * looks dead. Adding a point unsticks it, which is why the bug reads as
 * "editing does nothing" rather than "the polygon is broken".
 *
 * The workaround is to make the count differ on every update. The ring is
 * padded with repeats of its last vertex — a zero-length closing segment the
 * SDK draws as nothing — choosing one or two repeats so the length can never
 * match the length we sent last time, including across an insert or a delete.
 * Android's renderer diffs the coordinates properly and gets the ring unpadded.
 */
const usePathNudge = (
  ring: readonly LatLng[],
): readonly LatLng[] | LatLng[] => {
  const lastLength = useRef(-1);

  if (Platform.OS !== 'ios' || ring.length === 0) {
    return ring;
  }
  const repeats = ring.length + 1 === lastLength.current ? 2 : 1;
  lastLength.current = ring.length + repeats;

  const padded = [...ring];
  for (let i = 0; i < repeats; i += 1) {
    padded.push(ring[ring.length - 1]);
  }
  return padded;
};

const BoundaryPolygon: React.FC<BoundaryPolygonProps> = ({
  ring,
  invalid = false,
  color,
  strokeWidth = 2,
  tappable = false,
  onPress,
}) => {
  const coordinates = usePathNudge(ring);

  if (ring.length < 3) {
    return null;
  }

  const stroke = invalid ? COLORS.danger : color ?? COLORS.white;
  const fill = addAlpha(stroke, 0.18);

  return (
    <MapPolygon
      coordinates={coordinates.map(p => ({
        latitude: p.latitude,
        longitude: p.longitude,
      }))}
      strokeColor={stroke}
      strokeWidth={strokeWidth}
      fillColor={fill}
      tappable={tappable}
      onPress={onPress}
      geodesic={false}
    />
  );
};

export default React.memo(BoundaryPolygon);
