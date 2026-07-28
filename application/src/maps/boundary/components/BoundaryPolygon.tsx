/**
 * src/maps/boundary/components/BoundaryPolygon.tsx — the filled boundary shape.
 *
 * A pure render of the ring as a `<MapPolygon>`. It is a map CHILD (moves with
 * the map). Reused in two places: the read-only preview on FieldDetails, and the
 * live shape under the editor's handles.
 *
 * Cheap: one native shape. The cost of the editor is in the handles, not here.
 */

import React from 'react';
import { COLORS } from '../../../constants';
import { addAlpha } from '../../../utils';
import { MapPolygon } from '../../components/MapPrimitives';
import type { LatLng } from '../../types';

export interface BoundaryPolygonProps {
  ring: readonly LatLng[];
  /** Invalid rings (self-intersecting) render in a warning colour. */
  invalid?: boolean;
  /** Tint. Defaults to brand primary (valid) / danger (invalid). */
  color?: string;
  strokeWidth?: number;
  tappable?: boolean;
  onPress?: () => void;
}

const BoundaryPolygon: React.FC<BoundaryPolygonProps> = ({
  ring,
  invalid = false,
  color,
  strokeWidth = 2,
  tappable = false,
  onPress,
}) => {
  // A polygon needs ≥ 3 vertices; below that the caller renders a polyline
  // instead (see the editor). Render nothing rather than a broken shape.
  if (ring.length < 3) {
    return null;
  }

  const stroke = color ?? (invalid ? COLORS.danger : COLORS.primary);
  const fill = addAlpha(stroke, 0.18);

  // ⚠️ TEMP DIAGNOSTIC (Farm Boundary render bug) — remove after root cause.
  // Confirms the component mounts, its render count, and the EXACT props handed
  // to <MapPolygon>. If this logs valid coordinates but nothing draws, the fault
  // is native/library, not this component.
  if (__DEV__) {
    console.log('[BoundaryPolygon] render', {
      points: ring.length,
      first: ring[0],
      strokeColor: stroke,
      fillColor: fill,
      strokeWidth,
    });
  }

  return (
    <MapPolygon
      // Hand react-native-maps a FRESH, MUTABLE array. The engine's ring is a
      // `readonly LatLng[]` (and, when loaded from the persisted Redux slice,
      // Immer-frozen). The native Polygon takes ownership of its `coordinates`
      // array and does not render/update when given a shared/frozen one —
      // whereas Markers take a single coordinate object and are unaffected,
      // which is exactly why markers showed but the fill/outline did not.
      coordinates={ring.map(p => ({ latitude: p.latitude, longitude: p.longitude }))}
      strokeColor={stroke}
      strokeWidth={strokeWidth}
      fillColor={fill}
      tappable={tappable}
      onPress={onPress}
      // Rings edited on-device are already 6-dp; drawing geodesic segments adds
      // curvature the user did not place. Straight (planar) edges match taps.
      geodesic={false}
    />
  );
};

export default React.memo(BoundaryPolygon);
