import type { LatLng } from '../types';
import {
  distanceMeters,
  distanceToPolygonMeters,
  isPointInPolygon,
  isValidLatLng,
} from './geo';

export const ARRIVAL_TOLERANCE_M = 150;

export const ARRIVAL_POINT_RADIUS_M = 300;

export interface ArrivalCheck {
  readonly atField: boolean;
  readonly distanceM: number | null;
  readonly basis: 'boundary' | 'point' | 'unknown';
}

export interface ArrivalCheckInput {
  readonly position: LatLng | null;
  readonly boundary?: readonly LatLng[];
  readonly destination?: LatLng | null;
}

export const checkArrival = ({
  position,
  boundary,
  destination,
}: ArrivalCheckInput): ArrivalCheck => {
  if (!position || !isValidLatLng(position)) {
    return { atField: true, distanceM: null, basis: 'unknown' };
  }

  const ring = (boundary ?? []).filter(isValidLatLng);
  if (ring.length >= 3) {
    if (isPointInPolygon(position, ring)) {
      return { atField: true, distanceM: 0, basis: 'boundary' };
    }
    const edge = distanceToPolygonMeters(position, ring);
    if (edge !== null) {
      return {
        atField: edge <= ARRIVAL_TOLERANCE_M,
        distanceM: edge,
        basis: 'boundary',
      };
    }
  }

  if (destination && isValidLatLng(destination)) {
    const away = distanceMeters(position, destination);
    return {
      atField: away <= ARRIVAL_POINT_RADIUS_M,
      distanceM: away,
      basis: 'point',
    };
  }

  return { atField: true, distanceM: null, basis: 'unknown' };
};
