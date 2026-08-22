import type { LatLng } from '../../types';
import { findSelfIntersections, polygonAreaSqMeters } from '../../utils/geo';
import type { BoundaryValidation, BoundaryVertex } from '../types';
import { MIN_AREA_SQM, MIN_VERTICES } from './boundaryConfig';
import { toRing } from './boundaryGeometry';

export const validateRing = (ring: readonly LatLng[]): BoundaryValidation => {
  const hasMinVertices = ring.length >= MIN_VERTICES;
  const selfIntersections = hasMinVertices ? findSelfIntersections(ring) : [];
  const isSimple = selfIntersections.length === 0;
  const area = hasMinVertices && isSimple ? polygonAreaSqMeters(ring) : 0;
  const hasArea = area >= MIN_AREA_SQM;

  let reason: string | null = null;
  if (!hasMinVertices) {
    reason = `Add at least ${MIN_VERTICES} points to form a field.`;
  } else if (!isSimple) {
    reason = 'The boundary crosses itself. Drag the red points apart to fix it.';
  } else if (!hasArea) {
    reason = 'This area is too small. Zoom in and place the points more widely.';
  }

  return {
    isValid: hasMinVertices && isSimple && hasArea,
    reason,
    hasMinVertices,
    hasArea,
    isSimple,
    selfIntersections,
  };
};

export const validateVertices = (
  vertices: readonly BoundaryVertex[],
): BoundaryValidation => validateRing(toRing(vertices));

export const crossingVertexIds = (
  vertices: readonly BoundaryVertex[],
  intersections: ReadonlyArray<readonly [number, number]>,
): ReadonlySet<string> => {
  const ids = new Set<string>();
  const n = vertices.length;
  if (n === 0) {
    return ids;
  }
  for (const [a, b] of intersections) {
    ids.add(vertices[a].id);
    ids.add(vertices[(a + 1) % n].id);
    ids.add(vertices[b].id);
    ids.add(vertices[(b + 1) % n].id);
  }
  return ids;
};
