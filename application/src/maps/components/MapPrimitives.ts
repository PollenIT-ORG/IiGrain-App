/**
 * src/maps/components/MapPrimitives.ts — curated re-exports of the vendor's
 * map children.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * `AppMapView` wraps the map surface, but markers, polylines and polygons are
 * *children* of that surface — react-native-maps discovers them by component
 * identity, so they cannot be wrapped in an arbitrary component without the
 * native view tree losing track of them.
 *
 * Rather than punch a hole in the one-import rule ("only `src/maps/` imports
 * react-native-maps") by letting screens import `Marker` directly, the
 * primitives are re-exported from here. Call sites still import from
 * `src/maps`, and this file remains the single place to audit which vendor
 * primitives the app actually uses.
 *
 * ADDING A PRIMITIVE: export it here, document why the app needs it, and add it
 * to docs/maps/CHANGELOG.md. `Polygon`, `Circle`, `Geojson`, `Heatmap` and the
 * tile-overlay components all exist in the vendor package and are deliberately
 * NOT exported yet — they arrive with the GIS features listed in
 * docs/maps/FUTURE_SCOPE.md.
 */

export {
  /** A pin. Used for: the confirmed farm/field location, the visit destination,
   *  the live assessor position, and the draggable vertex handles of the Farm
   *  Boundary editor. */
  Marker as MapMarker,
  /** A line. Used for: the driving route on the visit-tracking screens. */
  Polyline as MapPolyline,
  /** A bubble anchored to a marker. Used for: the destination label. */
  Callout as MapCallout,
  /** A filled, closed shape. Used for: the Farm Boundary polygon
   *  (docs/maps/FarmBoundary). Supports `holes` (Phase-E exclusions) and
   *  `tappable`. */
  Polygon as MapPolygon,
} from 'react-native-maps';

export type {
  MapMarkerProps,
  MapPolylineProps,
  MapCalloutProps,
  MapPolygonProps,
  /** Emitted by a draggable marker on release — the vertex handle's new
   *  position. Used by the boundary editor's drag-to-move. */
  MarkerDragStartEndEvent,
} from 'react-native-maps';
