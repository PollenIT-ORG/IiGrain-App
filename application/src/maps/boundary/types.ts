import type { LatLng } from '../types';

export type BoundarySyncStatus = 'local' | 'pending' | 'synced' | 'conflict';

export interface BoundaryBBox {
  readonly minLat: number;
  readonly minLng: number;
  readonly maxLat: number;
  readonly maxLng: number;
}

export interface FieldBoundary {
  readonly fieldId: string;
  readonly farmId: string;
  readonly orgId: string | null;
  readonly ring: readonly LatLng[];
  readonly areaSqM: number;
  readonly center: LatLng;
  readonly bbox: BoundaryBBox;
  readonly version: number;
  readonly syncStatus: BoundarySyncStatus;
  readonly updatedAt: string;
}

export interface BoundaryVertex {
  readonly id: string;
  readonly latitude: number;
  readonly longitude: number;
}

export interface EdgeMidpoint {
  readonly edgeIndex: number;
  readonly fromId: string;
  readonly toId: string;
  readonly coordinate: LatLng;
}

export interface BoundarySnapshot {
  readonly vertices: readonly BoundaryVertex[];
  readonly closed: boolean;
}

export type BoundaryRejectionCode =
  | 'crossing'
  | 'min-vertices'
  | 'too-close'
  | 'not-closed';

export interface BoundaryRejection {
  readonly seq: number;
  readonly code: BoundaryRejectionCode;
  readonly message: string;
}

export interface DraftBoundary {
  readonly vertices: readonly BoundaryVertex[];
  readonly closed: boolean;
  readonly selectedId: string | null;
  readonly past: readonly BoundarySnapshot[];
  readonly future: readonly BoundarySnapshot[];
  readonly commitKey: string | null;
  readonly rejection: BoundaryRejection | null;
}

export interface BoundaryValidation {
  readonly isValid: boolean;
  readonly reason: string | null;
  readonly hasMinVertices: boolean;
  readonly hasArea: boolean;
  readonly isSimple: boolean;
  readonly selfIntersections: ReadonlyArray<readonly [number, number]>;
}

export interface GeoJSONPolygon {
  readonly type: 'Polygon';
  readonly coordinates: ReadonlyArray<ReadonlyArray<readonly [number, number]>>;
}

export type BoundaryMode = 'view' | 'draw' | 'edit';

export type BoundaryDrag =
  | {
      readonly kind: 'vertex';
      readonly vertexId: string;
      readonly index: number;
      readonly point: LatLng;
      readonly blocked: boolean;
    }
  | {
      readonly kind: 'edge';
      readonly edgeIndex: number;
      readonly edgeKey: string;
      readonly point: LatLng;
      readonly blocked: boolean;
    };
