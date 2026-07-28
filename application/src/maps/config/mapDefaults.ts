/**
 * src/maps/config/mapDefaults.ts — every magic number the map stack uses.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * Zoom levels, animation durations and jitter thresholds were previously
 * scattered as inline literals across four map components. A tuning change
 * ("the picker opens too zoomed out") then meant hunting through JSX. They live
 * here so map behaviour is configured in one reviewable place, and so the
 * documentation in docs/maps/ can point at a single source of truth.
 *
 * These are DEFAULTS, not constraints — every one can be overridden per call
 * site through props.
 */

import type { LatLng, MapEdgePadding, MapRegion } from '../types';
import { regionFromZoom } from '../utils/geo';

/**
 * Zoom levels, in Google's scheme: 0 = whole world, ~20 = building level.
 * Named rather than numbered so call sites read as intent.
 */
export const MAP_ZOOM = {
  /** Country-scale — the "we have no idea where the user is" opening view. */
  COUNTRY: 4,
  /** City-scale — after picking a search result. */
  CITY: 12,
  /** Neighbourhood — the working zoom for placing a farm/field pin. */
  PLACE: 16,
  /** Building/plot — after a successful GPS fix, where precision matters. */
  PRECISE: 17,
} as const;

export type MapZoomToken = (typeof MAP_ZOOM)[keyof typeof MAP_ZOOM];

/**
 * Fallback map centre: the geographic centre of India, at country zoom.
 *
 * WHY A HARDCODED CENTRE: a MapView with no `initialRegion` opens on the null
 * island (0,0) in the Atlantic, which looks like a broken map. This is only ever
 * shown for the fraction of a second before GPS or a saved coordinate arrives,
 * and only when both are unavailable.
 */
export const DEFAULT_MAP_CENTER: LatLng = { latitude: 20.5937, longitude: 78.9629 };

export const DEFAULT_MAP_REGION: MapRegion = regionFromZoom(
  DEFAULT_MAP_CENTER,
  MAP_ZOOM.COUNTRY,
);

/** Camera animation durations, in milliseconds. */
export const MAP_ANIMATION = {
  /** Standard camera glide. Matches the platform's own map animations. */
  DEFAULT_MS: 600,
  /** Re-fit after a live position update — slower, so tracking reads as smooth
   *  rather than as a series of jumps. */
  FOLLOW_MS: 800,
} as const;

/**
 * Two consecutive centres closer than this (~2 m at the equator) are treated as
 * the same place.
 *
 * WHY: `onRegionChangeComplete` fires again when the map settles after inertia,
 * with a centre that differs in the 7th decimal. Without this epsilon every pan
 * triggers a second reverse-geocode request and a second "Finding address…"
 * flicker. Carried over verbatim from the previous Leaflet implementation, where
 * the same problem was solved the same way.
 */
export const SAME_SPOT_EPSILON = 2e-5;

/** Padding used when fitting several points (e.g. assessor + destination). */
export const DEFAULT_FIT_PADDING: MapEdgePadding = {
  top: 90,
  right: 60,
  bottom: 140,
  left: 60,
};

/**
 * Coordinate precision persisted to the backend.
 *
 * The backend column is NUMERIC(9,6) (see MOBILE-MAP-INTEGRATION.md), i.e. six
 * decimals ≈ 11 cm. Rounding here — rather than sending the raw float the SDK
 * reports — keeps the value the user confirmed identical to the value stored,
 * so an edit screen re-opens on exactly the pin that was saved.
 */
export const COORDINATE_PRECISION = 6;
