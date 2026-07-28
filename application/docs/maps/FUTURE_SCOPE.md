# FUTURE_SCOPE — the GIS roadmap and how the module supports it

The map module was built for the features below, not just for the four screens
that exist today. Each entry states **what it needs**, **what already exists**,
and **what has to be built** — so an estimate can be made without re-reading the
code.

Effort key: **S** ≤ 2 days · **M** ≤ 1 week · **L** ≤ 3 weeks · **XL** a project.

---

## Priority 0 — do this before public release

### 0.1 Move Directions behind our backend — **M**

The one genuine security gap in the current design. Directions is a *web service*
API and cannot be restricted by package name or bundle id, so the key it uses
cannot be locked to this app. Full explanation:
[SECURITY.md §5](./SECURITY.md#5-the-directions-api-problem).

- **Needs:** `GET /maps/directions?origin=…&destination=…` on the iiGrain API,
  key held server-side.
- **Exists:** `directionsService.ts` was written for this — the response shape it
  parses is Google's, so a pass-through proxy needs no client parsing change.
- **To build:** the backend endpoint; change `DIRECTIONS_BASE_URL` to
  `` `${Env.API_BASE_URL}/maps/directions` ``; drop `key` from the params; remove
  `MAPS_API_KEY` from `AppEnv`. **One constant and two lines on the client.**
- **Bonus:** server-side caching of common routes cuts the bill further.

### 0.2 Split the Directions key — **S**

Interim mitigation while 0.1 is built. A second `.env` variable
(`MAPS_DIRECTIONS_KEY`), restricted to Directions only with a hard daily quota,
so a leaked routing key cannot touch SDK billing.

---

## Tier 1 — the field-boundary feature set

This is the reason Google was chosen over a WebView map. All of it is prop work
on `react-native-maps`; none of it needs native code.

### 1.1 Polygon rendering — **S**

Draw a saved field boundary on the map.

- **Exists:** `<Polygon>` ships in `react-native-maps`.
- **To build:** export it from `MapPrimitives.ts`; add `boundary?: LatLng[]` to
  `FieldLocationPreview`; add `regionContaining(boundary)` framing — the helper
  already exists in `utils/geo.ts`.

### 1.2 Interactive boundary drawing — **L**

Let a farmer walk or tap out a field's outline.

- **Exists:** `AppMapView.onPress` already returns a rounded `LatLng`;
  `MapCenterPin` demonstrates the overlay pattern; `useMapCamera` handles framing.
- **To build:** a `useBoundaryDraw` hook (vertex list, undo, drag-to-move,
  close-the-ring detection, self-intersection validation); vertex handle markers;
  a "walk the perimeter" mode driven by `watchPosition`.
- **Watch out for:** vertex markers must use `tracksViewChanges={false}` after
  settling, or a 40-vertex polygon will not stay at 60 fps.

### 1.3 Area calculation — **S**

Show hectares/acres as the boundary is drawn, and reconcile against the
`areaAcres` the farmer typed.

- **To build:** the spherical-excess (shoelace on a sphere) formula in
  `utils/geo.ts`. Pure function, unit-testable, ~20 lines. Same file, same rules.

### 1.4 GeoJSON import/export — **M**

Interoperate with the admin portal, government land records and drone software.

- **Exists:** `<Geojson>` ships in `react-native-maps`.
- **To build:** export it; a `utils/geojson.ts` converting our `LatLng[]` ↔
  GeoJSON `Feature<Polygon>` (note: GeoJSON is `[longitude, latitude]` — the
  reverse of our order, and the classic bug); backend fields to persist it.

### 1.5 KML import — **S**

Many land-record and survey exports are KML.

- **Exists:** `MapView`'s `kmlSrc` prop, plus `onKmlReady`.
- **To build:** expose `kmlSrc` on `AppMapView`; a file picker
  (`@react-native-documents/picker` is already a dependency).

---

## Tier 2 — imagery and agronomy

### 2.1 Satellite / hybrid toggle — **S**

The most-requested view for farmland: you can see the crop.

- **Exists:** `AppMapView` already accepts `mapKind` (`standard` | `satellite` |
  `hybrid` | `terrain`). Fully wired, just unused.
- **To build:** a segmented control overlay; persist the choice per user.
- **Note:** `customMapStyle` is ignored in satellite/hybrid — expected, document
  it in the UI if the styling difference is queried.

### 2.2 Terrain view — **S**

Elevation shading, useful for drainage and irrigation planning. Same mechanism as
2.1 (`mapKind="terrain"`).

### 2.3 NDVI / crop-health overlay — **XL**

Vegetation index imagery over the field boundary.

- **Needs:** an imagery provider (Sentinel Hub, Planet, Google Earth Engine),
  which is a commercial decision, not a code one.
- **Exists:** `<UrlTile>` / `<WMSTile>` in `react-native-maps` render exactly this
  kind of raster overlay.
- **To build:** provider integration, a date/period picker, an index legend,
  a tile-caching strategy, and a per-field time series.

### 2.4 Weather overlay — **M**

Rain radar / forecast tiles (OpenWeatherMap, Windy, IMD).

- **Exists:** `<UrlTile>` with an `opacity` prop.
- **To build:** provider key handling (the same three-chain problem as
  `MAPS_API_KEY` — reuse the pattern in [CONFIGURATION.md](./CONFIGURATION.md)),
  a time-slider, an animation loop.

### 2.5 Drone / orthomosaic overlay — **L**

Georeferenced drone imagery pinned over a field.

- **Exists:** `<Overlay>` (image + bounds) in `react-native-maps`.
- **To build:** upload + tiling pipeline on the backend; a bounds-and-opacity UI.

---

## Tier 3 — scale

### 3.1 Marker clustering — **M**

Needed the moment an assessor's map shows dozens of farms. Individual markers
degrade badly past ~100.

- **Exists natively:** `Google-Maps-iOS-Utils` (already a pod, pulled in by the
  Google subspec) and `com.google.maps.android:android-maps-utils` (already an
  Android dependency of `react-native-maps`). The clustering libraries are
  **already in the binary**.
- **To build:** JS clustering (e.g. supercluster) driven by
  `onRegionChangeComplete`, plus a cluster-bubble marker. Prefer this over a
  wrapper library — it keeps the one-import rule intact.

### 3.2 Multiple farms / fields on one map — **S** *(was M)*

A "portfolio" view of everything a farmer owns.

- **Shipped for farms** in 1.2.0 as `MapExplorer` (More → Help → Field Map),
  including per-status marker colours and search.
- **A fields version is now a `useMemo` and a few props** — write
  `fieldToEntity`, pass `placeSearchEnabled={false}`. Worked example in
  [BEST_PRACTICES.md §2.3](./BEST_PRACTICES.md#23-worked-example--a-fields-map-for-one-farm).
- **Still to build:** a list↔map selection binding (`onSelectEntity` is the hook
  for it), and 3.1 once the count grows past ~100.

### 3.3 Assessment module integration — **M**

Show where each assessment was actually carried out, and flag answers recorded
far from the field they claim to describe.

- **Exists:** `distanceMeters()`; assessments already carry coordinates.
- **To build:** a `radiusMeters` validation rule, a `<Circle>` geofence overlay
  (export from `MapPrimitives.ts`), and an "out of range" flag surfaced to
  reviewers.

---

## Tier 4 — resilience

### 4.1 Offline maps — **XL**

Farmland has poor connectivity; this is a real field requirement, not a nicety.

- **The hard truth:** the Google Maps SDKs **do not support user-controlled
  offline regions**. Their disk cache is opaque, small, and not addressable. This
  is the one roadmap item Google actively blocks.
- **Options:**
  1. `<LocalTile>` with a pre-bundled MBTiles pack for the operating region.
     Works with `react-native-maps` today. Limited area, large app size.
  2. Switch the *offline mode only* to MapLibre, which supports offline packs.
     Two renderers; significant complexity.
  3. Degrade gracefully: cache the last-known map snapshot image
     (`MapView.takeSnapshot()`) and render coordinates + boundary over it.
     **Cheapest, and probably the right first step.**
- **Decision needed before any estimate is meaningful.**

### 4.2 Map tile caching policy — **S**

Both SDKs cache tiles on disk automatically. What is missing is *measurement*:
instrument cache-hit behaviour and cold-start tile latency before optimising, and
before assuming the offline problem is as bad as it feels.

### 4.3 Devices without Google Play Services — **L**

De-Googled Android devices cannot render Google maps at all
([TROUBLESHOOTING.md #7](./TROUBLESHOOTING.md#7-google-play-services-missing--out-of-date)).
If that market matters, the answer is a MapLibre fallback renderer behind the
same `src/maps` interface — which is exactly what the one-import rule was
designed to make possible.

---

## Non-goals (recorded so they are not re-proposed)

| Not doing | Why |
|---|---|
| Google Places for search/reverse geocode | Nominatim works, is free, is already tuned. Places is billed per keystroke-session and would need the same web-service-key mitigation as Directions. |
| Turn-by-turn navigation in-app | Deep-link to the Google Maps app instead. Building navigation is a product, not a feature. |
| 3D / tilt / rotation | No product requirement; both gestures are easy to trigger accidentally while placing a pin. Disabled in `AppMapView`. |
| A web map target | The app is React Native CLI, no web build exists. |
| Cloud-based map IDs (`googleMapId`) | Would override `customMapStyle` and move our styling out of version control into a console. |

---

## How to add any of the above

1. Read [ARCHITECTURE.md §2.3](./ARCHITECTURE.md#23-layering-rules) — the layering
   rules are not optional.
2. Pure maths → `utils/`. Policy/throttling → `hooks/`. Numbers → `config/`.
   Network → `services/`. Rendering → `components/`.
3. New vendor primitive → export it from `MapPrimitives.ts` **with a comment
   saying why the app needs it**. Do not import `react-native-maps` anywhere else.
4. Export the public surface from `src/maps/index.ts`.
5. Add an entry to [CHANGELOG.md](./CHANGELOG.md).
6. If it touches native config, update [CONFIGURATION.md](./CONFIGURATION.md) and
   add its failure mode to [TROUBLESHOOTING.md](./TROUBLESHOOTING.md).
