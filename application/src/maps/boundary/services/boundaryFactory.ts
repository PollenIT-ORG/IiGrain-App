import type { LatLng } from '../../types';
import { boundingBox, polygonAreaSqMeters, polygonCentroid } from '../../utils/geo';
import type { FieldBoundary } from '../types';

export interface BuildBoundaryInput {
  readonly fieldId: string;
  readonly farmId: string;
  readonly orgId: string | null;
  readonly ring: readonly LatLng[];
  readonly version: number;
  readonly updatedAt: string;
}

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
    syncStatus: 'local',
    updatedAt: input.updatedAt,
  };
};
