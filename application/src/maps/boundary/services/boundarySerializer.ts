/**
 * src/maps/boundary/services/boundarySerializer.ts — LatLng[] ⇄ GeoJSON.
 *
 * This is the ONLY place the two GeoJSON traps are handled, so the engine and UI
 * never deal with them (see docs/maps/FarmBoundary/DATA_MODEL.md §3):
 *   1. GeoJSON is [longitude, latitude] — the reverse of our LatLng order.
 *   2. GeoJSON rings are CLOSED (first coord repeated as last); our engine keeps
 *      the ring OPEN. Close on serialise, open on parse — once, here.
 */

import type { LatLng } from '../../types';
import { isValidLatLng } from '../../utils/geo';
import type { GeoJSONPolygon } from '../types';

/**
 * Open LatLng ring → GeoJSON Polygon (single outer ring, closed, [lng,lat]).
 * Returns null for a ring too short to be a polygon.
 */
export const ringToGeoJSON = (ring: readonly LatLng[]): GeoJSONPolygon | null => {
  if (ring.length < 3) {
    return null;
  }
  const coords: Array<readonly [number, number]> = ring.map(p => [
    p.longitude,
    p.latitude,
  ]);
  // Close the ring: repeat the first coordinate as the last (GeoJSON spec).
  coords.push(coords[0]);
  return { type: 'Polygon', coordinates: [coords] };
};

/**
 * GeoJSON Polygon → open LatLng ring (outer ring only; holes ignored until
 * Phase E). Drops the duplicated closing coordinate and any invalid points.
 * Returns [] for anything that is not a usable polygon.
 */
export const geoJSONToRing = (
  polygon: GeoJSONPolygon | null | undefined,
): LatLng[] => {
  if (!polygon || polygon.type !== 'Polygon') {
    return [];
  }
  const outer = polygon.coordinates?.[0];
  if (!Array.isArray(outer) || outer.length < 4) {
    return [];
  }

  const ring: LatLng[] = [];
  for (const pair of outer) {
    const point: LatLng = { latitude: pair[1], longitude: pair[0] };
    if (isValidLatLng(point)) {
      ring.push(point);
    }
  }

  // Drop the closing echo point if present, returning an OPEN ring.
  if (ring.length >= 2) {
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first.latitude === last.latitude && first.longitude === last.longitude) {
      ring.pop();
    }
  }
  return ring;
};
