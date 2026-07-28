/**
 * src/maps/utils/geo.ts — pure geodesic maths. No React, no react-native-maps.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * Map components should contain layout and interaction, not trigonometry.
 * Everything here is a pure function of its inputs, which makes it the only part
 * of the map stack that is trivially unit-testable without a native module.
 *
 * Keep it that way: if a helper needs a MapView ref, it belongs in a hook.
 */

import type { LatLng, MapRegion } from '../types';

/** Earth's mean radius, metres. Used by the haversine distance below. */
const EARTH_RADIUS_M = 6_371_000;

const DEG_TO_RAD = Math.PI / 180;

/** Full longitudinal span of the world, in degrees — the basis of zoom maths. */
const WORLD_LONGITUDE_SPAN = 360;

/**
 * WGS-84 equatorial radius, metres. Used for POLYGON AREA only.
 *
 * Deliberately different from EARTH_RADIUS_M (mean radius, used for distance):
 * this is the value Google Maps' own `computeArea` uses, so areas computed here
 * agree with what a farmer would measure in Google Earth. Mixing the two radii
 * would make our area disagree with the incumbent tools farmers trust.
 */
const EARTH_RADIUS_AREA_M = 6_378_137;

export const toRadians = (degrees: number): number => degrees * DEG_TO_RAD;

/**
 * Rounds to `precision` decimals.
 *
 * Six decimals ≈ 11 cm, which is both finer than consumer GPS and exactly what
 * the backend's NUMERIC(9,6) columns store. Sending more precision than that is
 * noise that makes the saved value differ from the displayed one.
 */
export const roundCoordinate = (value: number, precision = 6): number => {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
};

/** True when the pair is a finite, in-range WGS-84 coordinate. */
export const isValidLatLng = (
  value: { latitude?: number | null; longitude?: number | null } | null | undefined,
): value is LatLng => {
  if (!value) {
    return false;
  }
  const { latitude, longitude } = value;
  return (
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
};

/**
 * True when two points are within `epsilon` degrees on both axes.
 *
 * Deliberately a cheap box test rather than a real distance: it runs on every
 * `onRegionChangeComplete`, and at the scale it is used for (metres) the
 * difference from a true great-circle comparison is irrelevant.
 */
export const isSameSpot = (a: LatLng, b: LatLng, epsilon: number): boolean =>
  Math.abs(a.latitude - b.latitude) < epsilon &&
  Math.abs(a.longitude - b.longitude) < epsilon;

/**
 * Great-circle distance in metres.
 *
 * Used to decide whether a moving assessor has travelled far enough to justify
 * re-requesting a route (see useRouteToDestination), and to render "1.2 km away"
 * when no route is available.
 */
export const distanceMeters = (from: LatLng, to: LatLng): number => {
  const dLat = toRadians(to.latitude - from.latitude);
  const dLng = toRadians(to.longitude - from.longitude);
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
};

/**
 * Converts a Google zoom level into the delta-based region MapView expects.
 *
 * Google's zoom is logarithmic: the visible world is 360° wide at z=0 and halves
 * with every level, so span = 360 / 2^zoom.
 *
 * NOTE ON ASPECT RATIO: a true conversion needs the view's pixel height/width,
 * which is not known here. We use the same delta on both axes; MapView then
 * expands whichever axis it must to fit the view, so the result is never
 * *less* zoomed-out than requested. Fitting exact bounds is what
 * `fitToCoordinates` is for.
 */
export const regionFromZoom = (center: LatLng, zoom: number): MapRegion => {
  const span = WORLD_LONGITUDE_SPAN / 2 ** Math.max(0, zoom);
  return {
    latitude: center.latitude,
    longitude: center.longitude,
    latitudeDelta: span,
    longitudeDelta: span,
  };
};

/**
 * Smallest region containing every point, inflated by `paddingRatio`.
 *
 * Used for the "show me the assessor AND the field" framing. Returns `null` for
 * an empty list so callers must handle the no-data case explicitly rather than
 * silently rendering the world view.
 *
 * `MIN_SPAN` guards the degenerate single-point case: without it the region
 * collapses to a zero-width rectangle and the map zooms to maximum, which on
 * Android renders as grey (no imagery at that level).
 */
const MIN_SPAN = 0.005; // ≈ 550 m

export const regionContaining = (
  points: readonly LatLng[],
  paddingRatio = 0.35,
): MapRegion | null => {
  const valid = points.filter(isValidLatLng);
  if (valid.length === 0) {
    return null;
  }

  let minLat = valid[0].latitude;
  let maxLat = valid[0].latitude;
  let minLng = valid[0].longitude;
  let maxLng = valid[0].longitude;

  for (const point of valid) {
    minLat = Math.min(minLat, point.latitude);
    maxLat = Math.max(maxLat, point.latitude);
    minLng = Math.min(minLng, point.longitude);
    maxLng = Math.max(maxLng, point.longitude);
  }

  const latSpan = Math.max(MIN_SPAN, (maxLat - minLat) * (1 + paddingRatio));
  const lngSpan = Math.max(MIN_SPAN, (maxLng - minLng) * (1 + paddingRatio));

  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: latSpan,
    longitudeDelta: lngSpan,
  };
};

/**
 * Human-readable distance: metres below 1 km, kilometres above, with one
 * decimal only where it carries information (2.4 km, but 12 km not 12.0 km).
 */
export const formatDistance = (meters: number): string => {
  if (!Number.isFinite(meters) || meters < 0) {
    return '';
  }
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  const km = meters / 1000;
  return `${km >= 10 ? Math.round(km) : km.toFixed(1)} km`;
};

/** Human-readable duration. Floors at "1 min" — "0 min away" reads as broken. */
export const formatDuration = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '';
  }
  const totalMinutes = Math.max(1, Math.round(seconds / 60));
  if (totalMinutes < 60) {
    return `${totalMinutes} min`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes === 0 ? `${hours} hr` : `${hours} hr ${minutes} min`;
};

// ─────────────────────────────────────────────────────────────────────────────
// POLYGON GEOMETRY — the maths behind the Farm Boundary module.
//
// Everything below operates on an OPEN ring: an ordered LatLng[] where the first
// point is NOT repeated at the end. Closing is handled mathematically (the `% n`
// wrap), never by a duplicated echo vertex — see
// docs/maps/FarmBoundary/DRAWING_ENGINE.md.
// ─────────────────────────────────────────────────────────────────────────────

/** A rectangle in lat/lng space — the polygon's extent. */
export interface BoundingBox {
  readonly minLat: number;
  readonly minLng: number;
  readonly maxLat: number;
  readonly maxLng: number;
}

/**
 * Signed area of a lat/lng ring on the sphere, in square metres.
 *
 * This is the spherical-excess formula Google Maps uses (`computeArea`), so the
 * result matches Google Earth to within rounding. The SIGN encodes winding
 * order (positive = counter-clockwise); callers that only want magnitude use
 * {@link polygonAreaSqMeters}.
 *
 * O(n). Returns 0 for fewer than 3 vertices.
 */
export const polygonSignedAreaSqMeters = (ring: readonly LatLng[]): number => {
  const n = ring.length;
  if (n < 3) {
    return 0;
  }
  let sum = 0;
  for (let i = 0; i < n; i += 1) {
    const p1 = ring[i];
    const p2 = ring[(i + 1) % n];
    // (λ2 − λ1) · (2 + sinφ1 + sinφ2), accumulated, then scaled by R²/2.
    sum +=
      toRadians(p2.longitude - p1.longitude) *
      (2 + Math.sin(toRadians(p1.latitude)) + Math.sin(toRadians(p2.latitude)));
  }
  return (sum * EARTH_RADIUS_AREA_M * EARTH_RADIUS_AREA_M) / 2;
};

/** Absolute polygon area in square metres. The value shown and stored. */
export const polygonAreaSqMeters = (ring: readonly LatLng[]): number =>
  Math.abs(polygonSignedAreaSqMeters(ring));

/**
 * Planar centroid of the ring (the "centre of mass" of the filled area).
 *
 * Used to frame the map and as the single-point fallback a field can keep even
 * when only a pin is needed. Falls back to the average of the vertices when the
 * area is degenerate (all points collinear), because the centroid formula
 * divides by area and would otherwise return NaN.
 */
export const polygonCentroid = (ring: readonly LatLng[]): LatLng => {
  const n = ring.length;
  if (n === 0) {
    return { latitude: 0, longitude: 0 };
  }
  if (n < 3) {
    return averagePoint(ring);
  }

  let twiceArea = 0;
  let lat = 0;
  let lng = 0;
  for (let i = 0; i < n; i += 1) {
    const p1 = ring[i];
    const p2 = ring[(i + 1) % n];
    // Planar shoelace cross-term. Fine at field scale for a centre point.
    const cross = p1.longitude * p2.latitude - p2.longitude * p1.latitude;
    twiceArea += cross;
    lat += (p1.latitude + p2.latitude) * cross;
    lng += (p1.longitude + p2.longitude) * cross;
  }

  if (twiceArea === 0) {
    return averagePoint(ring);
  }
  const factor = 1 / (3 * twiceArea);
  return { latitude: lat * factor, longitude: lng * factor };
};

/** Simple arithmetic mean of points — the degenerate-case centroid fallback. */
const averagePoint = (ring: readonly LatLng[]): LatLng => {
  const n = ring.length || 1;
  let lat = 0;
  let lng = 0;
  for (const p of ring) {
    lat += p.latitude;
    lng += p.longitude;
  }
  return { latitude: lat / n, longitude: lng / n };
};

/** Axis-aligned bounding box of a ring, or `null` for an empty ring. */
export const boundingBox = (ring: readonly LatLng[]): BoundingBox | null => {
  if (ring.length === 0) {
    return null;
  }
  let minLat = ring[0].latitude;
  let maxLat = ring[0].latitude;
  let minLng = ring[0].longitude;
  let maxLng = ring[0].longitude;
  for (const p of ring) {
    minLat = Math.min(minLat, p.latitude);
    maxLat = Math.max(maxLat, p.latitude);
    minLng = Math.min(minLng, p.longitude);
    maxLng = Math.max(maxLng, p.longitude);
  }
  return { minLat, minLng, maxLat, maxLng };
};

/**
 * Do the open segments (a→b) and (c→d) properly cross?
 *
 * "Properly" = they intersect at a point interior to both, not merely touching
 * at a shared endpoint. Uses the standard orientation (signed-area) test.
 * Planar in lat/lng, which is correct for the self-intersection use at field
 * scale. Pure, O(1).
 */
export const segmentsProperlyIntersect = (
  a: LatLng,
  b: LatLng,
  c: LatLng,
  d: LatLng,
): boolean => {
  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);
  // Strict: opposite orientations on both tests means a genuine interior cross.
  // Collinear/touching cases return false — a shared vertex is not a crossing.
  return o1 !== o2 && o3 !== o4 && o1 !== 0 && o2 !== 0 && o3 !== 0 && o4 !== 0;
};

/** Sign of the cross product (p→q→r): 1 = ccw, −1 = cw, 0 = collinear. */
const orientation = (p: LatLng, q: LatLng, r: LatLng): number => {
  const val =
    (q.latitude - p.latitude) * (r.longitude - q.longitude) -
    (q.longitude - p.longitude) * (r.latitude - q.latitude);
  if (val > 0) {
    return 1;
  }
  if (val < 0) {
    return -1;
  }
  return 0;
};

/**
 * Every pair of non-adjacent edges of the closed ring that cross.
 *
 * Returns pairs of edge start-indices so the UI can highlight exactly which
 * edges are wrong. Empty array = a simple (non-self-intersecting) polygon.
 *
 * O(n²): fine for farmland vertex counts (tens). If a field ever exceeds a few
 * hundred vertices, swap for a Bentley–Ottmann sweep — noted in DRAWING_ENGINE.
 */
export const findSelfIntersections = (
  ring: readonly LatLng[],
): Array<readonly [number, number]> => {
  const n = ring.length;
  const hits: Array<readonly [number, number]> = [];
  if (n < 4) {
    return hits;
  }
  for (let i = 0; i < n; i += 1) {
    const a = ring[i];
    const b = ring[(i + 1) % n];
    // Start j at i+2 so adjacent edges (which legitimately share a vertex) are
    // skipped. The `!(i === 0 && j === n - 1)` guard skips the wrap-around
    // adjacency between the first and last edge.
    for (let j = i + 2; j < n; j += 1) {
      if (i === 0 && j === n - 1) {
        continue;
      }
      const c = ring[j];
      const d = ring[(j + 1) % n];
      if (segmentsProperlyIntersect(a, b, c, d)) {
        hits.push([i, j] as const);
      }
    }
  }
  return hits;
};

/** True when the ring is a simple polygon (no self-intersections). */
export const isSimplePolygon = (ring: readonly LatLng[]): boolean =>
  findSelfIntersections(ring).length === 0;

// ── Area units ───────────────────────────────────────────────────────────────

/** Square metres per unit. Exact constants, so conversions never drift. */
export const AREA_UNITS = {
  sqm: { perSqMeter: 1, label: 'm²' },
  hectare: { perSqMeter: 1 / 10_000, label: 'ha' },
  acre: { perSqMeter: 1 / 4046.8564224, label: 'ac' },
  sqft: { perSqMeter: 10.763910417, label: 'ft²' },
} as const;

export type AreaUnit = keyof typeof AREA_UNITS;

/** Convert a square-metre area into the requested unit. */
export const convertArea = (sqMeters: number, unit: AreaUnit): number =>
  sqMeters * AREA_UNITS[unit].perSqMeter;

/**
 * Human-readable area, e.g. "1.24 ac", "3,450 m²".
 *
 * Precision by unit: 2 dp for acres/hectares (the values farmers reason about),
 * whole numbers for m²/ft² (fractional square metres are noise). The stored
 * value is always the raw `area_sqm` — this is display only.
 */
export const formatArea = (sqMeters: number, unit: AreaUnit): string => {
  if (!Number.isFinite(sqMeters) || sqMeters < 0) {
    return '—';
  }
  const value = convertArea(sqMeters, unit);
  const meta = AREA_UNITS[unit];
  if (unit === 'sqm' || unit === 'sqft') {
    return `${Math.round(value).toLocaleString()} ${meta.label}`;
  }
  return `${value.toFixed(2)} ${meta.label}`;
};
