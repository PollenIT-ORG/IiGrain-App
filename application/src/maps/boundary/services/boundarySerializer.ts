import type { LatLng } from '../../types';
import { isValidLatLng } from '../../utils/geo';
import type { GeoJSONPolygon } from '../types';

export const ringToGeoJSON = (ring: readonly LatLng[]): GeoJSONPolygon | null => {
  if (ring.length < 3) {
    return null;
  }
  const coords: Array<readonly [number, number]> = ring.map(p => [
    p.longitude,
    p.latitude,
  ]);
  coords.push(coords[0]);
  return { type: 'Polygon', coordinates: [coords] };
};

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

  if (ring.length >= 2) {
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first.latitude === last.latitude && first.longitude === last.longitude) {
      ring.pop();
    }
  }
  return ring;
};
