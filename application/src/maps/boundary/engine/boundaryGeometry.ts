import type { LatLng } from '../../types';
import { distanceMeters, segmentsProperlyIntersect } from '../../utils/geo';
import type { BoundaryVertex, EdgeMidpoint } from '../types';
import { MIN_EDGE_METERS } from './boundaryConfig';

export const toRing = (vertices: readonly BoundaryVertex[]): readonly LatLng[] =>
  vertices.map(v => ({ latitude: v.latitude, longitude: v.longitude }));

export const midpointOf = (a: LatLng, b: LatLng): LatLng => ({
  latitude: (a.latitude + b.latitude) / 2,
  longitude: (a.longitude + b.longitude) / 2,
});

export const edgeKeyOf = (from: BoundaryVertex, to: BoundaryVertex): string =>
  `${from.id}>${to.id}`;

export const edgeMidpoints = (
  vertices: readonly BoundaryVertex[],
): readonly EdgeMidpoint[] => {
  const n = vertices.length;
  if (n < 3) {
    return [];
  }
  const out: EdgeMidpoint[] = [];
  for (let i = 0; i < n; i += 1) {
    const from = vertices[i];
    const to = vertices[(i + 1) % n];
    out.push({
      edgeIndex: i,
      fromId: from.id,
      toId: to.id,
      coordinate: midpointOf(from, to),
    });
  }
  return out;
};

export const ringWithMoved = (
  ring: readonly LatLng[],
  index: number,
  point: LatLng,
): readonly LatLng[] => {
  const next = ring.slice();
  next[index] = point;
  return next;
};

export const ringWithInserted = (
  ring: readonly LatLng[],
  edgeIndex: number,
  point: LatLng,
): readonly LatLng[] => {
  const next = ring.slice();
  next.splice(edgeIndex + 1, 0, point);
  return next;
};

export const ringWithout = (
  ring: readonly LatLng[],
  index: number,
): readonly LatLng[] => ring.filter((_, i) => i !== index);

const sharesEndpoint = (n: number, a: number, b: number): boolean =>
  a === b || (a + 1) % n === b || (b + 1) % n === a;

const edgeCrossesRing = (
  ring: readonly LatLng[],
  edgeIndex: number,
  closed: boolean,
): boolean => {
  const n = ring.length;
  const lastEdge = closed ? n - 1 : n - 2;
  if (edgeIndex > lastEdge) {
    return false;
  }
  const a = ring[edgeIndex];
  const b = ring[(edgeIndex + 1) % n];
  for (let j = 0; j <= lastEdge; j += 1) {
    if (sharesEndpoint(n, edgeIndex, j)) {
      continue;
    }
    const c = ring[j];
    const d = ring[(j + 1) % n];
    if (segmentsProperlyIntersect(a, b, c, d)) {
      return true;
    }
  }
  return false;
};

export const ringHasCrossingAtEdges = (
  ring: readonly LatLng[],
  edgeIndexes: readonly number[],
  closed = true,
): boolean => {
  if (ring.length < 4) {
    return false;
  }
  return edgeIndexes.some(index => edgeCrossesRing(ring, index, closed));
};

export const movedVertexCreatesCrossing = (
  ring: readonly LatLng[],
  index: number,
  point: LatLng,
  closed = true,
): boolean => {
  const n = ring.length;
  if (n < 4) {
    return false;
  }
  const candidate = ringWithMoved(ring, index, point);
  const previousEdge = (index - 1 + n) % n;
  return ringHasCrossingAtEdges(candidate, [previousEdge, index], closed);
};

export const insertedVertexCreatesCrossing = (
  ring: readonly LatLng[],
  edgeIndex: number,
  point: LatLng,
  closed = true,
): boolean => {
  const candidate = ringWithInserted(ring, edgeIndex, point);
  if (candidate.length < 4) {
    return false;
  }
  return ringHasCrossingAtEdges(candidate, [edgeIndex, edgeIndex + 1], closed);
};

export const deletedVertexCreatesCrossing = (
  ring: readonly LatLng[],
  index: number,
): boolean => {
  const candidate = ringWithout(ring, index);
  if (candidate.length < 4) {
    return false;
  }
  const mergedEdge = (index - 1 + candidate.length) % candidate.length;
  return ringHasCrossingAtEdges(candidate, [mergedEdge], true);
};

export const appendCreatesCrossing = (
  ring: readonly LatLng[],
  point: LatLng,
): boolean => {
  const n = ring.length;
  if (n < 3) {
    return false;
  }
  const a = ring[n - 1];
  for (let j = 0; j <= n - 3; j += 1) {
    if (segmentsProperlyIntersect(a, point, ring[j], ring[j + 1])) {
      return true;
    }
  }
  return false;
};

export const closingCreatesCrossing = (ring: readonly LatLng[]): boolean => {
  const n = ring.length;
  if (n < 4) {
    return false;
  }
  return edgeCrossesRing(ring, n - 1, true);
};

export const tooCloseToNeighbours = (
  ring: readonly LatLng[],
  index: number,
  point: LatLng,
  minMeters = MIN_EDGE_METERS,
): boolean => {
  const n = ring.length;
  if (n < 2) {
    return false;
  }
  const previous = ring[(index - 1 + n) % n];
  const next = ring[(index + 1) % n];
  return (
    distanceMeters(previous, point) < minMeters ||
    distanceMeters(next, point) < minMeters
  );
};

export const nearestVertexIndex = (
  ring: readonly LatLng[],
  point: LatLng,
  maxMeters: number,
): number | null => {
  let best: number | null = null;
  let bestDistance = maxMeters;
  for (let i = 0; i < ring.length; i += 1) {
    const distance = distanceMeters(ring[i], point);
    if (distance <= bestDistance) {
      bestDistance = distance;
      best = i;
    }
  }
  return best;
};

export const longestEdgeIndex = (ring: readonly LatLng[]): number => {
  const n = ring.length;
  if (n < 3) {
    return 0;
  }
  let best = 0;
  let bestLength = -1;
  for (let i = 0; i < n; i += 1) {
    const length = distanceMeters(ring[i], ring[(i + 1) % n]);
    if (length > bestLength) {
      bestLength = length;
      best = i;
    }
  }
  return best;
};

export const offsetPoint = (
  point: LatLng,
  northMeters: number,
  eastMeters: number,
): LatLng => {
  const metersPerDegreeLat = 111_320;
  const metersPerDegreeLng =
    111_320 * Math.max(0.01, Math.cos((point.latitude * Math.PI) / 180));
  return {
    latitude: point.latitude + northMeters / metersPerDegreeLat,
    longitude: point.longitude + eastMeters / metersPerDegreeLng,
  };
};
