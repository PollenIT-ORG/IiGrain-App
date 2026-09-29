import type { LatLng } from '../types';

export interface CenterSource {
  latitude?: number | null;
  longitude?: number | null;
}

const centerOf = (source: CenterSource | null | undefined): LatLng | null => {
  const { latitude, longitude } = source ?? {};
  return typeof latitude === 'number' &&
    Number.isFinite(latitude) &&
    typeof longitude === 'number' &&
    Number.isFinite(longitude)
    ? { latitude, longitude }
    : null;
};

export const resolveFieldCenter = (
  ...sources: (CenterSource | null | undefined)[]
): LatLng | null => {
  for (const source of sources) {
    const center = centerOf(source);
    if (center) {
      return center;
    }
  }
  return null;
};

export const coordinatesKey = (points: readonly CenterSource[]): string =>
  points
    .map(point => {
      const center = centerOf(point);
      return center
        ? `${center.latitude.toFixed(6)},${center.longitude.toFixed(6)}`
        : '';
    })
    .join('|');
