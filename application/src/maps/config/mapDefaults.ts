import type { LatLng, MapEdgePadding, MapRegion } from '../types';
import { regionFromZoom } from '../utils/geo';

export const MAP_ZOOM = {
  COUNTRY: 4,
  CITY: 12,
  PLACE: 16,
  PRECISE: 17,
} as const;

export type MapZoomToken = (typeof MAP_ZOOM)[keyof typeof MAP_ZOOM];

export const DEFAULT_MAP_CENTER: LatLng = { latitude: 20.5937, longitude: 78.9629 };

export const DEFAULT_MAP_REGION: MapRegion = regionFromZoom(
  DEFAULT_MAP_CENTER,
  MAP_ZOOM.COUNTRY,
);

export const MAP_ANIMATION = {
  DEFAULT_MS: 600,
  FOLLOW_MS: 800,
} as const;

export const SAME_SPOT_EPSILON = 2e-5;

export const DEFAULT_FIT_PADDING: MapEdgePadding = {
  top: 90,
  right: 60,
  bottom: 140,
  left: 60,
};

export const COORDINATE_PRECISION = 6;
