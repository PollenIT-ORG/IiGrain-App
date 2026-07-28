/**
 * src/maps/boundary/services/boundaryFactory.ts — build a committed
 * FieldBoundary from an edited ring.
 *
 * Pure. All derived geometry (area, center, bbox) comes from the ONE geo.ts
 * function set, so the stored values can never disagree with what was displayed
 * (DATA_MODEL §6, invariant 2).
 */

import type { LatLng } from '../../types';
import { boundingBox, polygonAreaSqMeters, polygonCentroid } from '../../utils/geo';
import type { FieldBoundary } from '../types';

export interface BuildBoundaryInput {
  readonly fieldId: string;
  readonly farmId: string;
  readonly orgId: string | null;
  readonly ring: readonly LatLng[];
  /** Version to assign (caller bumps from the previously stored version). */
  readonly version: number;
  /** ISO timestamp — injected so the function stays pure/testable. */
  readonly updatedAt: string;
}

/**
 * Assemble a FieldBoundary. Returns null when the ring cannot form a polygon
 * (< 3 vertices or no bounding box) — callers must have validated first.
 */
export const buildFieldBoundary = (input: BuildBoundaryInput): FieldBoundary | null => {
  if (input.ring.length < 3) {
    return null;
  }
  const bbox = boundingBox(input.ring);
  if (!bbox) {
    return null;
  }

  return {
    fieldId: input.fieldId,
    farmId: input.farmId,
    orgId: input.orgId,
    ring: input.ring,
    areaSqM: polygonAreaSqMeters(input.ring),
    center: polygonCentroid(input.ring),
    bbox,
    version: input.version,
    // Phase D: local storage only. Phase E's sync layer flips this.
    syncStatus: 'local',
    updatedAt: input.updatedAt,
  };
};
