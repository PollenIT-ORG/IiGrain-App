/**
 * src/maps/index.ts — the public surface of the map module.
 *
 * THE ONE-IMPORT RULE
 * -------------------
 * Screens import from `src/maps` and from nowhere else in this folder:
 *
 *     import { LocationPickerModal, type PickedLocation } from '../../maps';   ✅
 *     import AppMapView from '../../maps/components/AppMapView';               ❌
 *     import MapView from 'react-native-maps';                                 ❌
 *
 * Why it is worth being strict about:
 *   - `react-native-maps` stays swappable. Everything above this line speaks in
 *     `LatLng` / `MapRegion`, not in vendor types.
 *   - The provider, the brand map style and the disabled-chrome decisions in
 *     AppMapView cannot be bypassed by a screen that renders its own MapView.
 *   - This file is the inventory. What the app can do with maps is exactly what
 *     is listed below — reviewable in one screen.
 *
 * Enforcement is by review, not by lint rule. If a second violation appears,
 * add `react-native-maps` to the `no-restricted-imports` block in `.eslintrc.js`
 * with an override for `src/maps/**`, mirroring the existing AppText guardrail.
 */

// ── Ready-to-use map screens/widgets ─────────────────────────────────────────
export { default as LocationPicker } from './components/LocationPicker';
export type { LocationPickerProps, PickedLocation } from './components/LocationPicker';

export { default as LocationPickerModal } from './components/LocationPickerModal';
export type { LocationPickerModalProps } from './components/LocationPickerModal';

export { default as FieldLocationPreview } from './components/FieldLocationPreview';
export type { FieldLocationPreviewProps } from './components/FieldLocationPreview';

export { default as VisitMap } from './components/VisitMap';
export type { VisitMapProps } from './components/VisitMap';

/**
 * Browse + search + select over a set of points. Domain-free: feed it
 * `MapEntity[]` and it serves farms, fields, assessors, visits — see the
 * "Reusing MapExplorer" recipe in docs/maps/BEST_PRACTICES.md.
 */
export { default as MapExplorer } from './components/MapExplorer';
export type { MapExplorerProps } from './components/MapExplorer';

// ── Building blocks, for new map features ────────────────────────────────────
export { default as AppMapView } from './components/AppMapView';
export type { AppMapViewProps, MapStyleVariant } from './components/AppMapView';

export { default as MapCenterPin } from './components/MapCenterPin';
export type { MapCenterPinProps } from './components/MapCenterPin';

export { MapMarker, MapPolyline, MapCallout, MapPolygon } from './components/MapPrimitives';
export type {
  MapMarkerProps,
  MapPolylineProps,
  MapCalloutProps,
} from './components/MapPrimitives';

// ── Hooks ────────────────────────────────────────────────────────────────────
export { useMapCamera } from './hooks/useMapCamera';
export type { UseMapCamera } from './hooks/useMapCamera';

export { useRouteToDestination } from './hooks/useRouteToDestination';
export type { UseRouteToDestination } from './hooks/useRouteToDestination';

// ── Services ─────────────────────────────────────────────────────────────────
export { fetchDrivingRoute } from './services/directionsService';

// ── Configuration ────────────────────────────────────────────────────────────
export {
  DEFAULT_FIT_PADDING,
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_REGION,
  COORDINATE_PRECISION,
  MAP_ANIMATION,
  MAP_ZOOM,
  SAME_SPOT_EPSILON,
} from './config/mapDefaults';
export { AGRI_MAP_STYLE, AGRI_MAP_STYLE_PREVIEW } from './config/mapStyle';

// ── Pure helpers ─────────────────────────────────────────────────────────────
export {
  distanceMeters,
  formatDistance,
  formatDuration,
  isSameSpot,
  isValidLatLng,
  regionContaining,
  regionFromZoom,
  roundCoordinate,
} from './utils/geo';
export { decodePolyline } from './utils/polyline';

// ── Types ────────────────────────────────────────────────────────────────────
export type {
  AppMapHandle,
  LatLng,
  MapEdgePadding,
  MapEntity,
  MapKind,
  MapRegion,
  MapRoute,
} from './types';

// ── Farm Boundary sub-feature ────────────────────────────────────────────────
// Re-exported here so screens can reach the headline pieces from `src/maps`. The
// full engine/services surface lives at `src/maps/boundary` (import from there
// for the reducer, serializer, repository). See docs/maps/FarmBoundary/.
export {
  BoundaryPolygon,
  BoundaryToolbar,
  AreaReadout,
  useBoundaryDraft,
  useBoundaryPersistence,
} from './boundary';
export type {
  FieldBoundary,
  DraftBoundary,
  BoundaryValidation,
  BoundaryMode,
  GeoJSONPolygon,
} from './boundary';
