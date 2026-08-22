import type { LatLng, MapRegion } from '../types';

const EARTH_RADIUS_M = 6_371_000;

const DEG_TO_RAD = Math.PI / 180;

const WORLD_LONGITUDE_SPAN = 360;

const EARTH_RADIUS_AREA_M = 6_378_137;

export const toRadians = (degrees: number): number => degrees * DEG_TO_RAD;

export const roundCoordinate = (value: number, precision = 6): number => {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
};

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

export const isSameSpot = (a: LatLng, b: LatLng, epsilon: number): boolean =>
  Math.abs(a.latitude - b.latitude) < epsilon &&
  Math.abs(a.longitude - b.longitude) < epsilon;

export const distanceMeters = (from: LatLng, to: LatLng): number => {
  const dLat = toRadians(to.latitude - from.latitude);
  const dLng = toRadians(to.longitude - from.longitude);
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
};

export const regionFromZoom = (center: LatLng, zoom: number): MapRegion => {
  const span = WORLD_LONGITUDE_SPAN / 2 ** Math.max(0, zoom);
  return {
    latitude: center.latitude,
    longitude: center.longitude,
    latitudeDelta: span,
    longitudeDelta: span,
  };
};

const MIN_SPAN = 0.005;

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

export interface BoundingBox {
  readonly minLat: number;
  readonly minLng: number;
  readonly maxLat: number;
  readonly maxLng: number;
}

export const polygonSignedAreaSqMeters = (ring: readonly LatLng[]): number => {
  const n = ring.length;
  if (n < 3) {
    return 0;
  }
  let sum = 0;
  for (let i = 0; i < n; i += 1) {
    const p1 = ring[i];
    const p2 = ring[(i + 1) % n];
    sum +=
      toRadians(p2.longitude - p1.longitude) *
      (2 + Math.sin(toRadians(p1.latitude)) + Math.sin(toRadians(p2.latitude)));
  }
  return (sum * EARTH_RADIUS_AREA_M * EARTH_RADIUS_AREA_M) / 2;
};

export const polygonAreaSqMeters = (ring: readonly LatLng[]): number =>
  Math.abs(polygonSignedAreaSqMeters(ring));

export const polygonPerimeterMeters = (
  ring: readonly LatLng[],
  closed = true,
): number => {
  if (ring.length < 2) {
    return 0;
  }
  let total = 0;
  for (let i = 1; i < ring.length; i += 1) {
    total += distanceMeters(ring[i - 1], ring[i]);
  }
  if (closed && ring.length >= 3) {
    total += distanceMeters(ring[ring.length - 1], ring[0]);
  }
  return total;
};

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

export const isPointInPolygon = (
  point: LatLng,
  ring: readonly LatLng[],
): boolean => {
  if (ring.length < 3) {
    return false;
  }
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const yi = ring[i].latitude;
    const xi = ring[i].longitude;
    const yj = ring[j].latitude;
    const xj = ring[j].longitude;

    const straddles = yi > point.latitude !== yj > point.latitude;
    if (
      straddles &&
      point.longitude < ((xj - xi) * (point.latitude - yi)) / (yj - yi) + xi
    ) {
      inside = !inside;
    }
  }
  return inside;
};

export const distanceToPolygonMeters = (
  point: LatLng,
  ring: readonly LatLng[],
): number | null => {
  if (ring.length < 2) {
    return null;
  }
  let best = Infinity;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    best = Math.min(best, distanceToSegmentMeters(point, ring[j], ring[i]));
  }
  return Number.isFinite(best) ? best : null;
};

const distanceToSegmentMeters = (p: LatLng, a: LatLng, b: LatLng): number => {
  const mPerDegLat = 111_320;
  const mPerDegLng = 111_320 * Math.cos(toRadians(p.latitude));

  const px = 0;
  const py = 0;
  const ax = (a.longitude - p.longitude) * mPerDegLng;
  const ay = (a.latitude - p.latitude) * mPerDegLat;
  const bx = (b.longitude - p.longitude) * mPerDegLng;
  const by = (b.latitude - p.latitude) * mPerDegLat;

  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) {
    return Math.hypot(ax - px, ay - py);
  }

  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq));
  return Math.hypot(ax + t * dx - px, ay + t * dy - py);
};

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
  return o1 !== o2 && o3 !== o4 && o1 !== 0 && o2 !== 0 && o3 !== 0 && o4 !== 0;
};

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

export const isSimplePolygon = (ring: readonly LatLng[]): boolean =>
  findSelfIntersections(ring).length === 0;

export const AREA_UNITS = {
  sqm: { perSqMeter: 1, label: 'm²' },
  hectare: { perSqMeter: 1 / 10_000, label: 'ha' },
  acre: { perSqMeter: 1 / 4046.8564224, label: 'ac' },
  sqft: { perSqMeter: 10.763910417, label: 'ft²' },
} as const;

export type AreaUnit = keyof typeof AREA_UNITS;

export const convertArea = (sqMeters: number, unit: AreaUnit): number =>
  sqMeters * AREA_UNITS[unit].perSqMeter;

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
