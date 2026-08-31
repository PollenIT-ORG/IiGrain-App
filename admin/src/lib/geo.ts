/**
 * Field boundary geometry. The rules and the maths match the mobile boundary
 * editor exactly, so a shape drawn on either side is judged the same way.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

export interface GeoJSONPolygon {
  type: "Polygon";
  /** One outer ring, closed. Positions are [longitude, latitude]. */
  coordinates: number[][][];
}

export const MIN_VERTICES = 3;
export const MAX_VERTICES = 500;
export const MIN_AREA_SQM = 10;

/** Two corners closer than this are the same corner. */
const DUPLICATE_EPSILON = 2e-5;

const EARTH_RADIUS_M = 6_378_137;
const DEG_TO_RAD = Math.PI / 180;
const SQM_PER_ACRE = 4046.8564224;

const toRadians = (deg: number): number => deg * DEG_TO_RAD;

export const round6 = (n: number): number => Math.round(n * 1e6) / 1e6;

/** Spherical excess, which is accurate enough at field scale. */
export function polygonAreaSqMeters(ring: readonly LatLng[]): number {
  const n = ring.length;
  if (n < 3) return 0;
  let sum = 0;
  for (let i = 0; i < n; i += 1) {
    const a = ring[i];
    const b = ring[(i + 1) % n];
    sum +=
      toRadians(b.lng - a.lng) *
      (2 + Math.sin(toRadians(a.lat)) + Math.sin(toRadians(b.lat)));
  }
  return Math.abs((sum * EARTH_RADIUS_M * EARTH_RADIUS_M) / 2);
}

export const sqMetersToAcres = (sqm: number): number => sqm / SQM_PER_ACRE;

export function areaAcresOf(ring: readonly LatLng[]): number {
  return Math.round(sqMetersToAcres(polygonAreaSqMeters(ring)) * 100) / 100;
}

function orientation(p: LatLng, q: LatLng, r: LatLng): number {
  const val =
    (q.lat - p.lat) * (r.lng - q.lng) - (q.lng - p.lng) * (r.lat - q.lat);
  if (val > 0) return 1;
  if (val < 0) return -1;
  return 0;
}

function segmentsCross(a: LatLng, b: LatLng, c: LatLng, d: LatLng): boolean {
  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);
  return o1 !== o2 && o3 !== o4 && o1 !== 0 && o2 !== 0 && o3 !== 0 && o4 !== 0;
}

/** Pairs of edge indexes that cross. Empty means the shape is simple. */
export function findSelfIntersections(
  ring: readonly LatLng[]
): Array<[number, number]> {
  const n = ring.length;
  const hits: Array<[number, number]> = [];
  if (n < 4) return hits;
  for (let i = 0; i < n; i += 1) {
    const a = ring[i];
    const b = ring[(i + 1) % n];
    for (let j = i + 2; j < n; j += 1) {
      if (i === 0 && j === n - 1) continue;
      if (segmentsCross(a, b, ring[j], ring[(j + 1) % n])) hits.push([i, j]);
    }
  }
  return hits;
}

export function isDuplicateOf(a: LatLng, b: LatLng): boolean {
  return (
    Math.abs(a.lat - b.lat) < DUPLICATE_EPSILON &&
    Math.abs(a.lng - b.lng) < DUPLICATE_EPSILON
  );
}

export interface BoundaryValidation {
  isValid: boolean;
  reason: string | null;
  areaAcres: number;
  crossings: Array<[number, number]>;
}

/** The same three checks the mobile editor runs, in the same order. */
export function validateRing(ring: readonly LatLng[]): BoundaryValidation {
  if (ring.length < MIN_VERTICES) {
    return {
      isValid: false,
      reason: `Add at least ${MIN_VERTICES} points to form a field.`,
      areaAcres: 0,
      crossings: [],
    };
  }
  if (ring.length > MAX_VERTICES) {
    return {
      isValid: false,
      reason: `A boundary can hold at most ${MAX_VERTICES} points.`,
      areaAcres: 0,
      crossings: [],
    };
  }

  const crossings = findSelfIntersections(ring);
  if (crossings.length) {
    return {
      isValid: false,
      reason: "The boundary crosses itself. Move the marked points apart.",
      areaAcres: 0,
      crossings,
    };
  }

  const sqm = polygonAreaSqMeters(ring);
  if (sqm < MIN_AREA_SQM) {
    return {
      isValid: false,
      reason: "This area is too small. Zoom in and place the points more widely.",
      areaAcres: 0,
      crossings: [],
    };
  }

  return {
    isValid: true,
    reason: null,
    areaAcres: Math.round(sqMetersToAcres(sqm) * 100) / 100,
    crossings: [],
  };
}

/** Ring to polygon, closing it the way the server expects. */
export function ringToBoundary(ring: readonly LatLng[]): GeoJSONPolygon | null {
  if (ring.length < MIN_VERTICES) return null;
  const positions = ring.map((p) => [round6(p.lng), round6(p.lat)]);
  const first = positions[0];
  const last = positions[positions.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) positions.push([...first]);
  return { type: "Polygon", coordinates: [positions] };
}

/** Polygon to ring, dropping the repeated closing position. */
export function boundaryToRing(
  boundary: GeoJSONPolygon | null | undefined
): LatLng[] {
  const positions = boundary?.type === "Polygon" ? boundary.coordinates?.[0] : null;
  if (!positions?.length) return [];
  const ring = positions
    .filter((p) => Array.isArray(p) && p.length >= 2)
    .map((p) => ({ lat: p[1], lng: p[0] }));
  if (ring.length > 1 && isDuplicateOf(ring[0], ring[ring.length - 1])) ring.pop();
  return ring;
}

/** The middle of a ring, for centring a map on it. */
export function ringCenter(ring: readonly LatLng[]): LatLng | null {
  if (!ring.length) return null;
  const lat = ring.reduce((s, p) => s + p.lat, 0) / ring.length;
  const lng = ring.reduce((s, p) => s + p.lng, 0) / ring.length;
  return { lat, lng };
}
