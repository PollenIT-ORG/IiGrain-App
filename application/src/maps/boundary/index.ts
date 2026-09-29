export type {
  FieldBoundary,
  DraftBoundary,
  BoundarySnapshot,
  BoundaryValidation,
  BoundaryBBox,
  BoundarySyncStatus,
  BoundaryMode,
  BoundaryVertex,
  BoundaryDrag,
  BoundaryRejection,
  BoundaryRejectionCode,
  EdgeMidpoint,
  GeoJSONPolygon,
} from './types';

export { boundaryReducer } from './engine/boundaryReducer';
export { emptyDraft, type BoundaryAction } from './engine/boundaryActions';
export { validateRing, validateVertices } from './engine/boundaryValidation';
export {
  edgeMidpoints,
  midpointOf,
  toRing,
  longestEdgeIndex,
  nearestVertexIndex,
  movedVertexCreatesCrossing,
  insertedVertexCreatesCrossing,
  deletedVertexCreatesCrossing,
} from './engine/boundaryGeometry';
export { BOUNDARY_HINTS } from './engine/boundaryMessages';
export {
  MIN_VERTICES,
  MIN_AREA_SQM,
  SOFT_MAX_VERTICES,
  UNDO_LIMIT,
  USE_OVERLAY_HANDLES,
} from './engine/boundaryConfig';

export { useBoundaryDraft, type UseBoundaryDraft } from './hooks/useBoundaryDraft';
export {
  useBoundaryEditor,
  type UseBoundaryEditor,
  type UseBoundaryEditorArgs,
} from './hooks/useBoundaryEditor';
export { useMapScale, type UseMapScale } from './hooks/useMapScale';
export {
  useBoundaryPersistence,
  type UseBoundaryPersistence,
  type BoundaryPersistenceArgs,
} from './hooks/useBoundaryPersistence';
export { useBoundaryRepository } from './hooks/useBoundaryRepository';

export { ringToGeoJSON, geoJSONToRing } from './services/boundarySerializer';
export { buildFieldBoundary } from './services/boundaryFactory';
export {
  createLocalBoundaryRepository,
  type BoundaryRepository,
  type SaveBoundaryInput,
  type LocalBoundaryStore,
} from './services/boundaryRepository';

export { default as BoundaryPolygon } from './components/BoundaryPolygon';
export type { BoundaryPolygonProps } from './components/BoundaryPolygon';
export { default as BoundaryVectorOverlay } from './components/BoundaryVectorOverlay';
export type {
  BoundaryVectorOverlayProps,
  BoundaryVectorOverlayHandle,
} from './components/BoundaryVectorOverlay';
export { default as BoundaryPointsPanel } from './components/BoundaryPointsPanel';
export type { BoundaryPointsPanelProps } from './components/BoundaryPointsPanel';
export { default as BoundaryPreviewMap } from './components/BoundaryPreviewMap';
export type { BoundaryPreviewMapProps } from './components/BoundaryPreviewMap';
export { default as VertexMarker } from './components/VertexMarker';
export type { VertexMarkerProps } from './components/VertexMarker';
export { default as MidpointHandle } from './components/MidpointHandle';
export type { MidpointHandleProps } from './components/MidpointHandle';
export { default as BoundaryHandleLayer } from './components/BoundaryHandleLayer';
export type {
  BoundaryHandleLayerProps,
  BoundaryHandleLayerHandle,
} from './components/BoundaryHandleLayer';
export { default as BoundaryDrawTutorial } from './components/BoundaryDrawTutorial';
export type { BoundaryDrawTutorialProps } from './components/BoundaryDrawTutorial';
export { default as AreaReadout, nextAreaUnit } from './components/AreaReadout';
export { default as BoundaryStats } from './components/BoundaryStats';
export type { BoundaryStatsProps } from './components/BoundaryStats';
export { default as MapActionRail } from './components/MapActionRail';
export type { MapActionRailProps } from './components/MapActionRail';
export { default as NudgePad } from './components/NudgePad';
export type { NudgePadProps } from './components/NudgePad';
export { default as BoundaryToolbar } from './components/BoundaryToolbar';
export type {
  BoundaryToolbarProps,
  BoundaryStatusTone,
} from './components/BoundaryToolbar';
