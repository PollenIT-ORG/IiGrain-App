/**
 * src/maps/boundary/engine/boundaryValidation.ts — pure validation of a ring.
 *
 * Two callers: the live toolbar (is Save enabled? why not?) and the persistence
 * layer (never store an invalid polygon). One source of truth so the button and
 * the guard can never disagree.
 */

import type { LatLng } from '../../types';
import { findSelfIntersections, polygonAreaSqMeters } from '../../utils/geo';
import type { BoundaryValidation } from '../types';
import { MIN_AREA_SQM, MIN_VERTICES } from './boundaryConfig';

/**
 * Validate a ring for saving. Order of reasons matters — the first failing rule
 * is the one shown, and they escalate from "not enough" → "wrong shape".
 */
export const validateRing = (ring: readonly LatLng[]): BoundaryValidation => {
  const hasMinVertices = ring.length >= MIN_VERTICES;
  const selfIntersections = hasMinVertices ? findSelfIntersections(ring) : [];
  const isSimple = selfIntersections.length === 0;
  // Area is only meaningful once the shape is simple; a self-crossing ring has
  // an ill-defined area.
  const area = hasMinVertices && isSimple ? polygonAreaSqMeters(ring) : 0;
  const hasArea = area >= MIN_AREA_SQM;

  let reason: string | null = null;
  if (!hasMinVertices) {
    reason = `Add at least ${MIN_VERTICES} points to form a field.`;
  } else if (!isSimple) {
    reason = 'The boundary crosses itself. Fix the crossing edge to save.';
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
