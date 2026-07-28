/**
 * src/maps/types.ts — the domain vocabulary of the map module.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * Every type the rest of the app is allowed to see when it works with maps is
 * declared here, in OUR words, not the vendor's. Screens import `LatLng` from
 * `src/maps`, never from `react-native-maps`.
 *
 * That indirection is the whole point of the module: `react-native-maps` is an
 * implementation detail. If the project ever swaps renderer (MapLibre, a newer
 * major of react-native-maps, a web build), only `src/maps/components/*` changes
 * — the ~40 call sites that speak in `LatLng`/`MapRegion` do not.
 *
 * These shapes are intentionally STRUCTURALLY IDENTICAL to the react-native-maps
 * equivalents, so passing one where the other is expected type-checks with no
 * casts and no runtime mapping cost.
 */

/** A WGS-84 point. Latitude −90…90, longitude −180…180. */
export interface LatLng {
  readonly latitude: number;
  readonly longitude: number;
}

/**
 * A visible map rectangle: a centre plus its span in degrees.
 *
 * `latitudeDelta` is the north–south span of the viewport; `longitudeDelta` the
 * east–west span. Smaller delta = more zoomed in. This is the "region" model;
 * the alternative "camera" model (zoom/pitch/heading) is deliberately NOT
 * exposed — the app has no 3D/tilted map requirement, and mixing the two models
 * on one MapView causes the camera to fight the region prop.
 */
export interface MapRegion extends LatLng {
  readonly latitudeDelta: number;
  readonly longitudeDelta: number;
}

/**
 * The base-map renderings we support. This is a deliberate subset of
 * react-native-maps' `MapType`:
 *   - `standard`  — road map. The default.
 *   - `satellite` — imagery only, no labels.
 *   - `hybrid`    — imagery + road/label overlay. The useful one for farmland.
 *   - `terrain`   — elevation shading. Google Maps only.
 * Apple-only values (`mutedStandard`, `satelliteFlyover`, …) are excluded
 * because this app pins BOTH platforms to the Google renderer — see
 * docs/maps/README.md.
 */
export type MapKind = 'standard' | 'satellite' | 'hybrid' | 'terrain';

/** Padding, in points, kept between fitted content and the map edges. */
export interface MapEdgePadding {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

/**
 * Imperative handle exposed by `AppMapView`.
 *
 * WHY IMPERATIVE AT ALL: camera movement is an *animation*, not state. Driving
 * it declaratively (`region={...}`) fights the user's own gestures — every pan
 * would be snapped back on the next render. So the camera is uncontrolled by
 * default (`initialRegion`) and moved through these methods.
 */
export interface AppMapHandle {
  /** Animate the viewport to an explicit rectangle. */
  animateToRegion: (region: MapRegion, durationMs?: number) => void;
  /** Animate to a point, deriving the rectangle from a zoom level (0–20). */
  animateToCoordinate: (coordinate: LatLng, zoom?: number, durationMs?: number) => void;
  /** Jump (no animation) to a point. Used for first paint, where an animation
   *  from the world view to the target reads as a glitch. */
  setCoordinate: (coordinate: LatLng, zoom?: number) => void;
  /** Animate so that every supplied point is visible, with padding. */
  fitToCoordinates: (coordinates: readonly LatLng[], padding?: MapEdgePadding) => void;
}

/**
 * One pin on a browsable map — the unit `MapExplorer` renders, searches and
 * selects.
 *
 * WHY THIS TYPE IS DOMAIN-FREE
 * The first consumer plots farms. The next will plot fields, then assessors,
 * then visits, then soil samples. None of those share a shape, but all of them
 * are "a labelled point you can find and tap". Modelling the *interaction*
 * rather than the *entity* is what lets one component serve all of them —
 * adapting `Farm[] → MapEntity[]` is a `useMemo` at the call site, not a fork
 * of the component.
 *
 * `data` carries the original object back to the caller's handlers, so a screen
 * never has to keep a parallel id→entity lookup.
 */
export interface MapEntity<TData = unknown> {
  /** Stable identity. Used as the marker key and the selection handle. */
  readonly id: string;
  readonly coordinate: LatLng;
  /** Primary line: marker callout, search result, detail card heading. */
  readonly title: string;
  /** Secondary line. Typically an address or a parent name. */
  readonly subtitle?: string;
  /** Third line in the detail card only, e.g. "12 acres · 3 fields". */
  readonly meta?: string;
  /** Marker tint. Defaults to the brand primary. Use it to carry status. */
  readonly pinColor?: string;
  /** Folded into the local search index alongside title and subtitle. */
  readonly searchText?: string;
  /** The caller's own object, handed back untouched in callbacks. */
  readonly data?: TData;
}

/** Result of a routing lookup — see src/maps/services/directionsService.ts. */
export interface MapRoute {
  /** Decoded road geometry, ready to hand to a polyline. */
  readonly path: readonly LatLng[];
  readonly distanceMeters: number;
  readonly durationSeconds: number;
}
