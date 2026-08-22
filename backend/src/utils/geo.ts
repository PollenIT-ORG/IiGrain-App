// Small geodesy helpers for the arrival geofence. Distances are metres. Polygons
// are GeoJSON (outer ring, [lng, lat] order). Kept in sync with the mobile app's
// geo.ts so the app's "you look ~420 m away" warning predicts the server verdict.
import type { GeoJSONPolygon } from "../models/field.model.js";

export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_M = 6_371_000;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance between two points, in metres. */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(s)));
}

function outerRing(polygon: GeoJSONPolygon | null): LatLng[] | null {
  const ring =
    polygon && polygon.type === "Polygon" ? polygon.coordinates?.[0] : null;
  if (!Array.isArray(ring) || ring.length < 4) return null;
  return ring.map(([lng, lat]) => ({ lat, lng }));
}

/** Ray-casting point-in-polygon test against the outer ring. */
export function isPointInPolygon(
  point: LatLng,
  polygon: GeoJSONPolygon | null
): boolean {
  const pts = outerRing(polygon);
  if (!pts) return false;
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].lng;
    const yi = pts[i].lat;
    const xj = pts[j].lng;
    const yj = pts[j].lat;
    const intersect =
      yi > point.lat !== yj > point.lat &&
      point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// Distance from a point to a segment, both projected to local metres around the
// point (equirectangular - accurate at the tens-of-metres scale a geofence uses).
function distanceToSegmentMeters(p: LatLng, a: LatLng, b: LatLng): number {
  const mPerDegLat = 111_320;
  const mPerDegLng = 111_320 * Math.cos(toRad(p.lat));
  const ax = (a.lng - p.lng) * mPerDegLng;
  const ay = (a.lat - p.lat) * mPerDegLat;
  const bx = (b.lng - p.lng) * mPerDegLng;
  const by = (b.lat - p.lat) * mPerDegLat;
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : (-ax * dx + -ay * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(cx, cy);
}

/**
 * Metres from a point to a polygon: 0 when inside, otherwise the distance to the
 * nearest edge. Null when the polygon is not a usable ring.
 */
export function distanceToPolygonMeters(
  point: LatLng,
  polygon: GeoJSONPolygon | null
): number | null {
  const pts = outerRing(polygon);
  if (!pts) return null;
  if (isPointInPolygon(point, polygon)) return 0;
  let min = Infinity;
  for (let i = 0; i < pts.length - 1; i += 1) {
    min = Math.min(min, distanceToSegmentMeters(point, pts[i], pts[i + 1]));
  }
  return min;
}
