export { default as LocationPicker } from './components/LocationPicker';
export type { LocationPickerProps, PickedLocation } from './components/LocationPicker';

export { default as LocationPickerModal } from './components/LocationPickerModal';
export type { LocationPickerModalProps } from './components/LocationPickerModal';

export { default as FieldLocationPreview } from './components/FieldLocationPreview';
export type { FieldLocationPreviewProps } from './components/FieldLocationPreview';

export { default as VisitMap } from './components/VisitMap';
export type { VisitMapProps } from './components/VisitMap';

export { default as MapExplorer } from './components/MapExplorer';
export type { MapExplorerProps } from './components/MapExplorer';

export { default as AppMapView } from './components/AppMapView';
export type { AppMapViewProps, MapStyleVariant } from './components/AppMapView';

export { default as MapPlaceSearch } from './components/MapPlaceSearch';
export type { MapPlaceSearchProps } from './components/MapPlaceSearch';

export { default as MapCenterPin } from './components/MapCenterPin';
export type { MapCenterPinProps } from './components/MapCenterPin';

export { default as MapKindSwitch, MAP_KIND_OPTIONS } from './components/MapKindSwitch';
export type { MapKindSwitchProps, MapKindOption } from './components/MapKindSwitch';

export { MapMarker, MapPolyline, MapCallout, MapPolygon } from './components/MapPrimitives';
export type {
  MapMarkerProps,
  MapPolylineProps,
  MapCalloutProps,
} from './components/MapPrimitives';

export { useMapCamera } from './hooks/useMapCamera';
export type { UseMapCamera } from './hooks/useMapCamera';

export { useRouteToDestination } from './hooks/useRouteToDestination';
export type { UseRouteToDestination } from './hooks/useRouteToDestination';

export { fetchDrivingRoute } from './services/directionsService';

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

export {
  distanceMeters,
  distanceToPolygonMeters,
  formatDistance,
  formatDuration,
  isPointInPolygon,
  isSameSpot,
  isValidLatLng,
  regionContaining,
  regionFromZoom,
  roundCoordinate,
} from './utils/geo';
export { decodePolyline } from './utils/polyline';
export {
  checkArrival,
  ARRIVAL_TOLERANCE_M,
  ARRIVAL_POINT_RADIUS_M,
} from './utils/geofence';
export type { ArrivalCheck, ArrivalCheckInput } from './utils/geofence';

export type {
  AppMapHandle,
  LatLng,
  MapEdgePadding,
  MapEntity,
  MapKind,
  MapRegion,
  MapRoute,
} from './types';

export {
  BoundaryPolygon,
  BoundaryPreviewMap,
  BoundaryToolbar,
  BoundaryStats,
  MapActionRail,
  NudgePad,
  VertexMarker,
  MidpointHandle,
  AreaReadout,
  useBoundaryDraft,
  useBoundaryEditor,
  useBoundaryPersistence,
} from './boundary';
export type {
  FieldBoundary,
  DraftBoundary,
  BoundaryValidation,
  BoundaryMode,
  BoundaryVertex,
  EdgeMidpoint,
  GeoJSONPolygon,
} from './boundary';
