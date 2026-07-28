# CHANGELOG — Google Maps integration

Every change to `src/maps/`, to the native map configuration, or to the Google
Cloud key setup gets an entry here. Newest first.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Scope tags: `[js]` `[android]` `[ios]` `[cloud]` `[docs]`

---

## [1.3.0] — 2026-07-24 — Farm Boundary module (Phase D: draw · edit · area · local save)

Adds the Farm Boundary drawing system as a sub-feature of `src/maps`. A farmer
opens a field → draws its polygon on satellite imagery → edits vertices → sees
live area → saves. Storage is **local-only** this phase (Redux + redux-persist);
the backend contract for Phase E is specified in
[FarmBoundary/DATA_MODEL.md §4](./FarmBoundary/DATA_MODEL.md). Full design:
[docs/maps/FarmBoundary/](./FarmBoundary/README.md).

### Added

**Pure geometry — `src/maps/utils/geo.ts` `[js]`**
- `polygonAreaSqMeters` / `polygonSignedAreaSqMeters` — spherical-excess area
  using Google's equatorial radius (6 378 137 m), so areas match Google Earth.
- `polygonCentroid`, `boundingBox`, `segmentsProperlyIntersect`,
  `findSelfIntersections`, `isSimplePolygon`.
- `AREA_UNITS`, `convertArea`, `formatArea` (acre/ha/m²/ft², exact constants).
- All pure — unit-testable the moment the repo's Jest setup is fixed.

**Engine (pure, no React/SDK/Redux) — `src/maps/boundary/engine/` `[js]`**
- `boundaryReducer` — `(draft, action) → draft`: add / move / insert / delete /
  close / select / undo / redo / load / reset. Open-ring model (no duplicated
  closing point); every geometry op is one undo step; ≤ 30-step history.
- `boundaryValidation` — min-vertices · self-intersection · area-floor, one
  source of truth for the Save button and the persistence guard.
- `boundaryConfig` — all tunables in one place.

**Services (the repository seam) — `src/maps/boundary/services/` `[js]`**
- `boundarySerializer` — `LatLng[] ⇄ GeoJSON`, handling the two GeoJSON traps
  (`[lng,lat]` order, closed ring) in ONE place so the engine never sees them.
- `boundaryFactory` — builds a `FieldBoundary` with derived area/center/bbox
  from the one geo function set (displayed area can never differ from stored).
- `boundaryRepository` — `BoundaryRepository` interface + `createLocalBoundaryRepository`.
  **The swap point:** Phase E replaces one binding with an API repository; no
  component/hook/engine file changes.

**Hooks — `src/maps/boundary/hooks/` `[js]`**
- `useBoundaryDraft` — the engine as React state, with selectors (area,
  validation, canUndo/Redo/Close/Save).
- `useBoundaryPersistence` — wires Redux to the repository interface (the file
  that changes in Phase E).

**Components — `src/maps/boundary/components/` `[js]`**
- `BoundaryPolygon` (fill/stroke, invalid-state colour), `VertexHandle`
  (draggable, `tracksViewChanges` latch), `MidpointHandle` (insert ghost),
  `AreaReadout` (live area + unit cycle), `BoundaryToolbar` (mode-driven).

**Screen & state `[js]`**
- `src/screens/farms/BoundaryEditorScreen` — thin orchestrator; satellite-first;
  view/draw/edit modes; crosshair precision placement; discard-on-back guard.
- `boundarySlice` (keyed by fieldId, persisted) + store registration.
- `BoundaryEditor` route; entry button + boundary preview overlay on
  FieldDetails Overview.

**Shared additions**
- `MapPrimitives.ts` exports `MapPolygon` + `MarkerDragStartEndEvent`.
- `FieldLocationPreview` accepts `children` (to overlay the saved boundary).
- `redux/hooks.ts` exports typed `useAppStore` (imperative read for the repo).

### Notes
- **Storage is local this phase.** `syncStatus` is always `'local'`; `version`
  bumps locally. Both fields exist now so Phase-E sync is additive (no data
  migration). See ADR-B01/B02 in
  [FarmBoundary/DECISION_LOG.md](./FarmBoundary/DECISION_LOG.md).
- **One-import rule intact:** boundary components reach the SDK only through
  `MapPrimitives`; nothing under `boundary/` imports `react-native-maps`.
- **Acreage:** the drawn area and the typed `field.areaAcres` are kept
  independent — the drawn value never overwrites user input (ADR-B08).

### Deferred to Phase E
GPS-walk recording, backend sync, GeoJSON/KML import-export, offline tiles,
multi-polygon, holes, versioned history/approval. All designed-for in the data
model; none built.

---

## [1.2.0] — 2026-07-23 — `MapExplorer` extracted; the map surface is now reusable

The browse/search/select behaviour built for farms is now a domain-free
component. No user-visible change; this is an architecture change so the same
surface can serve fields, assessors and visits without a fork. Rationale and
trade-offs: **ADR-012** in [DECISION_LOG.md](./DECISION_LOG.md).

### Added

**`src/maps/types.ts` `[js]`**
- `MapEntity<TData>` — `{ id, coordinate, title, subtitle?, meta?, pinColor?,
  searchText?, data? }`. Models the *interaction* ("a labelled point you can
  find and tap"), not the *entity*, which is why one component can serve farms,
  fields, assessors and soil samples. `data` carries the caller's original object
  back through callbacks, so a screen never needs a parallel id→object lookup.

**`src/maps/components/MapExplorer.tsx` `[js]`**
- Reusable map surface: markers, two-source search (local index + Nominatim),
  base-map switcher, fit-all and my-location controls, count pill, detail card,
  loading and empty states.
- Configurable and all-optional: `searchEnabled`, `searchPlaceholder`,
  `searchGroupLabel`, `placeSearchEnabled`, `mapKindSwitchEnabled`,
  `initialMapKind`, `showFitAllControl`, `showMyLocationControl`,
  `formatCountLabel`, `actionLabel`/`onAction`, `renderDetail`,
  `onSelectEntity`, `emptyTitle`/`emptyMessage`/`emptyActionLabel`,
  `renderEmpty`.
- `placeSearchEnabled={false}` matters for scoped maps — an assessor picking a
  farm should not be able to fly to Paris.
- Ships its own empty state rather than importing `components/farms/EmptyState`,
  so the maps module does not depend on the farms feature.

### Changed

- **`src/screens/help/FieldMapScreen.tsx`** — reduced from ~480 lines to ~130.
  What remains is only what is genuinely about farms: the Redux source, the
  `farmToEntity` adapter, and the navigation target. This is the shape every
  future map screen should have.
- **`src/screens/help/FieldMapScreenStyle.ts`** — now just the page shell. All
  map-surface styling moved into `MapExplorer`, so a second consumer inherits
  the identical look without copying a stylesheet.
- **`src/maps/index.ts`** — exports `MapExplorer`, `MapExplorerProps`,
  `MapEntity`.

### Documentation

- **`docs/maps/BEST_PRACTICES.md` (new)** — the twelve rules for working in the
  module, each with the concrete cost of breaking it; the "Reusing MapExplorer"
  recipe with a worked fields-map example; a prop-selection table; when *not* to
  use it; performance and PR review checklists.
- **`docs/maps/DECISION_LOG.md` (new)** — ADR-001 … ADR-012, each with Decision /
  Context / Alternatives / Trade-offs / Future impact. Includes the honest ones:
  ADR-008 (the Directions key cannot be app-restricted) and ADR-005 (the silent
  Apple-Maps fallback on iOS).
- **`README.md`** — both new documents added to the index.
- **`ARCHITECTURE.md`** — new §2.2a: the four map surfaces, which to reach for,
  and the adapter data-flow diagram.

### Migration notes

None. No API changed and no native configuration was touched — `npm install`
and `pod install` are not required for this version.

### Technical debt found (not changed — pre-existing, outside this scope)

- **`src/components/farms/FieldMapView.tsx` is a dead mock map.** 364 lines that
  render *hardcoded percentage-positioned coloured rectangles* as fake field
  parcels (`POSITIONS: ViewStyle[] = [{ top: '6%', left: '5%', … }]`). It is
  exported from `components/farms/index.ts` but imported by **no screen**.
  It predates the Google Maps work.
  - **Why it matters:** it is demo code in a production tree, it is named one
    character away from the real `FieldMapScreen`, and a future developer
    looking for "the field map" will find it first.
  - **Recommendation:** delete it. Real field-parcel rendering is
    [FUTURE_SCOPE §1.1 (polygons)](./FUTURE_SCOPE.md), which will use
    `MapPrimitives.Polygon` over real coordinates — nothing in this file is
    salvageable for that.
  - Not deleted here because it is unrelated to this change and belongs in its
    own commit.
- **~22 pre-existing lint errors** across `screens/auth`, `screens/farms`,
  `components/farms` — all unused imports and unused locals left behind by
  commented-out experiments. `src/maps/**` and `src/screens/help/**` are clean.

---

## [1.1.1] — 2026-07-23 — Field Map search

### Added

**`src/screens/help/FieldMapScreen.tsx` `[js]`**
- Search box over the map, backed by **two sources in one list**:
  - **Your farms** — filtered locally against a precomputed index. Instant,
    works offline, costs nothing. This is what the user wants on their own map
    almost every time.
  - **Places** — Nominatim (`services/geocoding.searchPlaces`), fired only on the
    **debounced** query (450 ms) and only from 3 characters, with an
    `AbortController` so a superseded request never lands.
- Choosing a farm selects it and flies the camera in. Choosing a place flies
  there and drops a distinct secondary-coloured pin — without it, a jump to an
  empty patch of map looks like nothing happened.

### Performance notes (why the code looks the way it does)

This screen re-renders on every keystroke and hosts a **native** map view, so
three things are load-bearing rather than stylistic:

1. `markerNodes` is `useMemo`'d. `children` is one of `AppMapView`'s props and
   `AppMapView` is `React.memo`'d — rebuilding the marker array per keystroke
   would defeat that memo and re-render the native map subtree while typing.
2. The farm search index (`haystack`, `nameLower`) is built once per farm-list
   change, so filtering is a substring test instead of lowercasing every farm on
   every character.
3. Result rows are a memoised `ResultItem` with a stable `renderItem` /
   `keyExtractor`, and local matches are capped at 8 — a 300-farm account typing
   "a" must not render 300 rows.

Ranking: name-prefix matches sort above substring matches, then alphabetically,
so ordering is stable rather than API-order.

### Notes

- The input has **no `onBlur` handler** on purpose. Blur fires before a tap on a
  result lands, so closing the panel there makes every result un-tappable on
  iOS. The panel closes on selection, on submit, or on a map tap.
- Map chrome (base-map switcher, count pill, controls) and the farm card hide
  while results are open, so nothing collides with the panel.

---

## [1.1.0] — 2026-07-23 — Field Map screen, reached from More → Help

First feature built **on top of** the map module rather than migrated into it —
so it is also the proof that the module's public surface is sufficient. It adds
no files under `src/maps/` and imports nothing from `react-native-maps`.

### Added

**Screens `[js]`**
- `src/screens/help/HelpScreen.tsx` (+ `HelpScreenStyle.ts`) — the destination of
  More → Help, which previously did nothing. Data-driven list (`HELP_ITEMS`) so
  a second tool is one array entry.
- `src/screens/help/FieldMapScreen.tsx` (+ `FieldMapScreenStyle.ts`) — every farm
  with saved coordinates on one map:
  - `<MapMarker>` per farm, coloured by `FarmStatus` so the map carries the same
    signal as the farm list. Uses the SDK's default pin bitmap (no custom child
    view), so `tracksViewChanges={false}` costs nothing even with many farms.
  - **Standard / Satellite / Hybrid switcher** — the first consumer of
    `AppMapView`'s `mapKind` prop. Satellite is the view that matters on
    farmland. `terrain` is deliberately omitted: indistinguishable from
    `standard` at these zooms, and a fourth option overflows a small phone.
  - "Show all" (`camera.fitToCoordinates`) and "My location"
    (`getCurrentLocation` → `camera.animateToCoordinate`) controls.
  - Tapping a marker opens a card with area/field count and a **View farm**
    action into `FarmDetails`; tapping bare map dismisses it.
  - Farms without coordinates are **filtered out**, never rendered at `(0,0)` —
    a marker in the Atlantic reads as data corruption.

**Navigation `[js]`**
- `AppStackParamList`: `Help: undefined` and
  `FieldMap: { focusFarmId?: string } | undefined`. `focusFarmId` lets a future
  farm-detail page deep-link into the map already centred on that farm.
- `AppNavigator`: both screens registered.

### Changed

- `src/screens/more/MoreScreen.tsx` — the `Help` menu item had **no `target`**,
  so tapping it was a no-op. It now navigates to `Help`. `MenuItem['target']`
  widened to include `'Help'`.

### Notes

- `FieldMapScreen` reads the shared farm slice and only dispatches
  `fetchFarmsThunk` when that slice is genuinely empty. An unguarded fetch would
  fight FarmsScreen and the dashboard over the same single-slot cache — the
  known refetch-loop failure mode of this codebase.
- Location failure here uses a **toast**, not `Alert`. That is safe on this
  screen because it is a plain route; inside `LocationPickerModal` it would not
  be, because the root toast renders behind a native `<Modal>`.

---

## [1.0.0] — 2026-07-23 — Initial integration; Leaflet retired

Replaces the Leaflet-in-WebView map stack with the native Google Maps SDK on both
platforms, behind a new reusable module at `src/maps/`.

### Added

**Dependency `[js]`**
- `react-native-maps@1.29.0`. No other packages were added — geolocation
  (`@react-native-community/geolocation`), SVG (`react-native-svg`) and HTTP
  (`axios`) were already present and are reused.

**Module `src/maps/` `[js]`**
- `index.ts` — the module's only public surface. Screens import from here and
  nowhere else ("the one-import rule").
- `types.ts` — `LatLng`, `MapRegion`, `MapKind`, `MapEdgePadding`,
  `AppMapHandle`, `MapRoute`. Vendor-independent domain vocabulary.
- `config/mapDefaults.ts` — zoom tokens, default centre/region, animation
  durations, `SAME_SPOT_EPSILON`, fit padding, `COORDINATE_PRECISION`.
- `config/mapStyle.ts` — `AGRI_MAP_STYLE`, `AGRI_MAP_STYLE_PREVIEW`. Muted
  agricultural base map: POI business hidden, transit hidden, roads desaturated.
- `utils/geo.ts` — `roundCoordinate`, `isValidLatLng`, `isSameSpot`,
  `distanceMeters` (haversine), `regionFromZoom`, `regionContaining`,
  `formatDistance`, `formatDuration`. Pure; no React, no vendor imports.
- `utils/polyline.ts` — decoder for Google's Encoded Polyline Algorithm. Written
  in-house (~30 lines) rather than adding a dependency to a hot path.
- `services/directionsService.ts` — Google Directions client. Never throws;
  returns `null` on every failure so the caller falls back to a straight line.
- `hooks/useMapCamera.ts` — camera controller that buffers commands issued before
  `onMapReady` and replays the last one. Prevents the "map never moves on a cold
  start" class of bug.
- `hooks/useRouteToDestination.ts` — throttled routing (re-request only after
  40 m of movement **and** 8 s), with a straight-line fallback that never clears
  a previously good route.
- `components/AppMapView.tsx` — the only file importing `MapView`. Pins
  `PROVIDER_GOOGLE` on both platforms, applies the brand style, disables the
  Android toolbar / rotate / pitch, normalises events, exposes `AppMapHandle`.
- `components/MapPrimitives.ts` — the only file importing `Marker`, `Polyline`,
  `Callout`.
- `components/MapCenterPin.tsx` — fixed centre pin with a native-driver lift
  animation and a stationary ground shadow.

**Native — Android `[android]`**
- `android/app/build.gradle`: `resolveMapsApiKey()` reads `$MAPS_API_KEY` then
  `application/.env`; feeds `defaultConfig.manifestPlaceholders["MAPS_API_KEY"]`.
  Warns (does not fail) when the key is absent.
- `AndroidManifest.xml`: `com.google.android.geo.API_KEY` meta-data and
  `com.google.android.gms.version` meta-data.
- `android/build.gradle`: pinned `googlePlayServicesMapsVersion = 19.1.0`,
  `…BaseVersion = 18.5.0`, `…LocationVersion = 21.3.0`.

**Native — iOS `[ios]`**
- `ios/Podfile`: `pod 'react-native-maps/Google'` (before `use_react_native!`) —
  enables the Google renderer instead of the Apple MapKit default.
- `ios/Podfile`: a `post_install` hook that reads `.env`, writes the gitignored
  `ios/Config/Env.generated.xcconfig`, and `#include?`s it from the
  CocoaPods-generated xcconfigs.
- `ios/iiGrain/Info.plist`: `GMSApiKey = $(MAPS_API_KEY)`.
- `ios/iiGrain/AppDelegate.swift`: `import GoogleMaps` and
  `configureGoogleMaps()` as the first statement of
  `didFinishLaunchingWithOptions`. Warns instead of crashing on a missing key.

**Configuration `[js]`**
- `.env.example`: documented `MAPS_API_KEY`, listing all three consumers and the
  Cloud APIs that must be enabled.
- `.gitignore`: `ios/Config/Env.generated.xcconfig`.

**Documentation `[docs]`**
- `docs/maps/` — README, SETUP, CONFIGURATION, ARCHITECTURE, FLOW, SECURITY,
  TROUBLESHOOTING, FUTURE_SCOPE, CHANGELOG.

### Changed

- `src/config/env.ts` — `MAPS_API_KEY` was being assigned into `Env` without
  being declared on the `AppEnv` interface, so `Env.MAPS_API_KEY` was invisible
  to TypeScript and unusable. Declared, documented, and normalised with
  `(MAPS_API_KEY ?? '').trim()`.
- `src/screens/farms/AddFarmScreen.tsx` — imports `LocationPickerModal` and
  `PickedLocation` from `../../maps`.
- `src/screens/farms/AddFieldScreen.tsx` — same.
- `src/screens/farms/FieldDetailsScreen.tsx` — imports `FieldLocationPreview`
  from `../../maps`.
- `src/screens/home/FarmerVisitTrackingScreen.tsx` — imports `VisitMap` from
  `../../maps`.
- `src/screens/assessor/AssessorVisitScreen.tsx` — same.
- `src/screens/farms/FarmsScreen.tsx` — removed a dead `LocationPicker` import
  (its only reference was inside a commented-out block).

**Behavioural changes inside the migrated components**

| Component | Change | Why |
|---|---|---|
| `LocationPicker` | Native tiles; camera via `useMapCamera` | Removes the WebView, the two CDN dependencies and the JS-bridge round trip per pan |
| `LocationPicker` | Opens directly at `initial` instead of flying there after load | Animating in from the country view read as a glitch |
| `FieldLocationPreview` | Real `<Marker>` instead of a centre pin | The coordinate is fixed, so the pin must move with the map |
| `FieldLocationPreview` | `tracksViewChanges={false}` | Marker bitmap caching; the main cost of a map inside a scrolling page |
| `VisitMap` | Google Directions instead of the public OSRM demo server | The route must agree with the tiles beneath it; OSRM's demo endpoint is explicitly not for production |
| `VisitMap` | Camera follows only after 150 m of movement | GPS noise is 5–20 m; re-framing on noise made the map twitch |
| `VisitMap` | The pulsing assessor halo was removed | A continuously animated marker child forces `tracksViewChanges` to stay true, re-uploading the bitmap every frame |

### Removed

- `src/components/location/LocationPicker.tsx`
- `src/components/location/LocationPickerModal.tsx`
- `src/components/location/FieldLocationPreview.tsx`
- `src/components/location/VisitMap.tsx`
- `src/components/location/mapHtml.ts` — the Leaflet picker HTML
- `src/components/location/visitMapHtml.ts` — the Leaflet tracking HTML, including
  the OSRM routing client

**Runtime dependencies retired with them:** `unpkg.com/leaflet@1.9.4`,
`tile.openstreetmap.org`, `router.project-osrm.org`. Rationale in
[README.md §5](./README.md#5-why-we-are-not-using-leaflet).

`react-native-webview` remains a dependency — it is used elsewhere in the app and
was not removed.

### Deliberately unchanged

- **Nominatim** (`src/services/geocoding.ts`) still powers place search and
  reverse geocoding. Free, already integrated, already tuned. Moving to Google
  Places is a separate, separately-billed decision — see
  [FUTURE_SCOPE.md](./FUTURE_SCOPE.md#non-goals-recorded-so-they-are-not-re-proposed).
- **`src/services/currentLocation.ts`** — the two-profile one-shot GPS
  acquisition and its actionable error codes were already correct.
- **Location permissions** in `AndroidManifest.xml` and `Info.plist` were already
  present from the previous location work.
- **The picker's interaction design** — fixed centre pin, lifting shadow, save
  gated on a resolved address — was ported deliberately. It was good.

### Known issues / follow-ups

- **`P0` The Directions API key cannot be app-restricted.** Google web-service
  APIs support only IP/referrer restrictions, which a mobile client cannot
  satisfy. Mitigate by proxying through our backend, or at minimum by using a
  separate quota-capped key. See
  [SECURITY.md §5](./SECURITY.md#5-the-directions-api-problem) and
  [FUTURE_SCOPE.md §0](./FUTURE_SCOPE.md#priority-0--do-this-before-public-release).
- **The one-import rule is enforced by review, not by lint.** If it is violated
  twice, add `react-native-maps` to `no-restricted-imports` in `.eslintrc.js`
  with an override for `src/maps/**`, mirroring the existing AppText guardrail.
- **`npx jest` fails to start** with
  `TypeError: Cannot read properties of undefined (reading 'testEnvironmentOptions')`.
  This is a pre-existing incompatibility between the `jest@^25` devDependency and
  `@react-native/jest-preset@0.86` — **it predates this change** and is unrelated
  to maps. It does mean the new pure helpers in `utils/geo.ts` and
  `utils/polyline.ts` cannot yet be unit-tested; fixing the Jest version is
  tracked separately.

---

## Template for the next entry

```markdown
## [x.y.z] — YYYY-MM-DD — Short title

### Added
- `[scope]` What, and **why**.

### Changed
- `[scope]` What changed, what the previous behaviour was, why it changed.

### Removed
- `[scope]` What went, and what replaced it.

### Migration notes
- Anything another developer must do (pod install, key change, cache reset).
```
