/**
 * src/maps/boundary/index.ts — public surface of the Farm Boundary sub-feature.
 *
 * Screens import from here (or from `src/maps`, which re-exports the headline
 * pieces). Nothing here imports react-native-maps directly — that goes through
 * `src/maps/components/MapPrimitives`, preserving the module's one-import rule.
 *
 * The engine, hooks and serializer are exported so the SAME machinery can drive
 * future surfaces (GPS-walk recording, GeoJSON import) without duplication.
 */

// ── Types ────────────────────────────────────────────────────────────────────
export type {
  FieldBoundary,
  DraftBoundary,
  BoundarySnapshot,
  BoundaryValidation,
  BoundaryBBox,
  BoundarySyncStatus,
  BoundaryMode,
  GeoJSONPolygon,
} from './types';

// ── Engine (pure) ────────────────────────────────────────────────────────────
export { boundaryReducer } from './engine/boundaryReducer';
export { emptyDraft, type BoundaryAction } from './engine/boundaryActions';
export { validateRing } from './engine/boundaryValidation';
export {
  MIN_VERTICES,
  MIN_AREA_SQM,
  SOFT_MAX_VERTICES,
  UNDO_LIMIT,
} from './engine/boundaryConfig';

// ── Hooks ────────────────────────────────────────────────────────────────────
export { useBoundaryDraft, type UseBoundaryDraft } from './hooks/useBoundaryDraft';
export {
  useBoundaryPersistence,
  type UseBoundaryPersistence,
  type BoundaryPersistenceArgs,
} from './hooks/useBoundaryPersistence';

// ── Services ─────────────────────────────────────────────────────────────────
export { ringToGeoJSON, geoJSONToRing } from './services/boundarySerializer';
export { buildFieldBoundary } from './services/boundaryFactory';
export {
  createLocalBoundaryRepository,
  type BoundaryRepository,
  type SaveBoundaryInput,
  type LocalBoundaryStore,
} from './services/boundaryRepository';

// ── Components ───────────────────────────────────────────────────────────────
export { default as BoundaryPolygon } from './components/BoundaryPolygon';
export type { BoundaryPolygonProps } from './components/BoundaryPolygon';
export { default as VertexHandle } from './components/VertexHandle';
export { default as MidpointHandle } from './components/MidpointHandle';
export { default as AreaReadout, nextAreaUnit } from './components/AreaReadout';
export { default as BoundaryToolbar } from './components/BoundaryToolbar';
