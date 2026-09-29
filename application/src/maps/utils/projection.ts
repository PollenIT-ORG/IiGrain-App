import type { LatLng, MapRegion } from '../types';

export interface ViewSize {
  width: number;
  height: number;
}

export interface ScreenPoint {
  x: number;
  y: number;
}

export const projectToScreen = (
  coord: LatLng,
  region: MapRegion,
  size: ViewSize,
): ScreenPoint => {
  const west = region.longitude - region.longitudeDelta / 2;
  const north = region.latitude + region.latitudeDelta / 2;
  const x = ((coord.longitude - west) / region.longitudeDelta) * size.width;
  const y = ((north - coord.latitude) / region.latitudeDelta) * size.height;
  return { x, y };
};

export const projectRing = (
  ring: readonly LatLng[],
  region: MapRegion,
  size: ViewSize,
): ScreenPoint[] => ring.map(coord => projectToScreen(coord, region, size));

export const pointsToSvg = (points: readonly ScreenPoint[]): string =>
  points.map(p => `${p.x},${p.y}`).join(' ');

export const unprojectFromScreen = (
  point: ScreenPoint,
  region: MapRegion,
  size: ViewSize,
): LatLng => {
  const west = region.longitude - region.longitudeDelta / 2;
  const north = region.latitude + region.latitudeDelta / 2;
  return {
    longitude: west + (point.x / size.width) * region.longitudeDelta,
    latitude: north - (point.y / size.height) * region.latitudeDelta,
  };
};
