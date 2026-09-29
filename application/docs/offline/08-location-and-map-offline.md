# 08 — Location, Maps and Boundaries Offline

The single most important distinction in this document:

```
GPS capability          — a device sensor. Works with the radio off.
Map visualisation       — Google tiles over HTTPS. Does not work offline.
Geocoding               — Nominatim over HTTPS. Does not work offline.
Boundary data capture   — pure geometry over lat/lng. Works offline.
```

Three of those four work offline. The app currently couples them together so that
the one that does not (geocoding) blocks the ones that do.

---

## 1. How location works today

### GPS — `src/services/currentLocation.ts`

* `@react-native-community/geolocation` 3.4.0.
* Android: runtime `ACCESS_FINE_LOCATION` via `PermissionsAndroid`, mapped to
  `granted | denied | blocked`.
* iOS: `Geolocation.requestAuthorization`.
* Two-stage fix: `LOW_ACCURACY` (`enableHighAccuracy: false`, 12 s timeout,
  `maximumAge: 60000`) then `HIGH_ACCURACY` (20 s, `maximumAge: 0`).
* Error codes normalised to `permission_denied | permission_blocked |
  location_services_disabled | timeout | position_unavailable`.
* `services/locationGate.ts` turns those into an explanatory dialog with a
  deep-link to settings.

**No network call anywhere in this file.** GPS is fully offline-capable, subject to
satellite acquisition, which is slower without A-GPS assistance data. Expect first
fixes of 30–60 s in the open on a cold receiver with no connectivity, versus a few
seconds when assisted. The existing two-stage strategy plus the `timeout` copy in
`locationGate.ts` already handles that gracefully.

### Geocoding — `src/services/geocoding.ts`

* Its **own** axios instance against `https://nominatim.openstreetmap.org`
  (not the app API), 12 s timeout.
* `searchPlaces(query)` → `/search` — place search box.
* `reverseGeocode(lat, lng)` → `/reverse` — turns a pin into an address string.

Both are hard network calls. Offline they fail.

### Maps — `src/maps/components/AppMapView.tsx`

```
MAPS_KEYED  = Env.MAPS_API_KEY.length > 0
MAP_PROVIDER = Platform.OS === 'ios' && !MAPS_KEYED ? undefined : PROVIDER_GOOGLE
```

* `react-native-maps` 1.29.0 with `PROVIDER_GOOGLE` on Android always, and on iOS
  when a Maps key is configured (it is — `android/gradle.properties` carries a
  `MAPS_API_KEY`, and `ios/Podfile` generates an xcconfig from `.env`).
* iOS falls back to Apple MapKit only when the key is missing.
* `mapType` is switchable (`standard` / `hybrid` / `satellite`) via `MapKindSwitch`.
* **No `UrlTile`, no `urlTemplate`, no tile cache directory, no offline region
  download anywhere in the codebase.** Verified by grep.

Tiles are therefore fetched on demand and cached only by the platform SDK's own
opportunistic cache, which is not a supported offline mechanism and must not be
relied on.

---

## 2. The blocker nobody would guess

`src/maps/components/LocationPicker.tsx:261`:

```
const canConfirm = !!selected && !!address && !addressLoading && isReady;
```

`address` is populated **only** by `reverseGeocode`. Offline, the call fails, the
component shows *"Unable to fetch address. Tap Retry."*, and **the Confirm button
stays disabled forever**.

So today an offline farmer:

* gets a perfectly good GPS fix ✅
* sees a blank/grey map ❌ (cosmetic)
* **cannot confirm the location at all** ❌ (functional)

and since `AddFieldScreen` hard-gates on `locationMissing`, **field creation is
impossible offline even though every input is local**. Farm creation is softer —
`location` is optional there — but the picker is the only way to set coordinates, so
in practice it blocks that too.

**Fix (small, self-contained):** allow confirming with coordinates only. Set
`canConfirm = !!selected && !addressLoading && isReady`, and when the address is
unavailable, return `PickedLocation` with an empty/placeholder `address` plus a flag,
storing `address_resolved = 0` on the row (`04`). Resolve the text later. This one
change converts "location offline: impossible" into "location offline: works, address
fills in later".

---

## 3. Boundary drawing — already local-first

The boundary module is the most offline-ready code in the app, and it is the
template for everything else.

* `redux/slices/boundarySlice.ts` — `byFieldId` is **persisted** to AsyncStorage.
* `maps/boundary/types.ts` already declares
  `BoundarySyncStatus = 'local' | 'pending' | 'synced' | 'conflict'`.
* `maps/boundary/services/boundaryRepository.ts` defines a `LocalBoundaryStore`
  abstraction with an in-memory/local implementation.
* `remoteBoundaryRepository.save()` writes **locally first**, then `PUT`s, then
  marks `synced`. `load()` falls back to the cached boundary on any network error.
* `screens/farms/BoundaryEditorScreen.tsx:334` already shows the right copy:
  *"Saved on this device, but could not upload. It will sync on the next save."*

What is missing is only the last mile: there is **no sync engine**, so a boundary
saved offline uploads only when the user happens to save it again while online.
Migrating `boundarySlice.byFieldId` into `field_boundaries` (`04`) and pointing the
existing `LocalBoundaryStore` interface at SQLite is a mechanical change — the
abstraction is already there.

Geometry itself (`maps/boundary/engine/`) is pure maths on lat/lng: area, bbox,
centroid, self-intersection validation, vertex/midpoint handling, undo/redo. Zero
network. Fully offline.

---

## 4. Capability table

| Location capability | Offline possible? | Dependency | Recommendation |
|---|---|---|---|
| GPS coordinate acquisition | **Yes** | device GPS + runtime permission | Keep as is. Widen the `timeout` copy to mention slower fixes without a network |
| Latitude/longitude storage | **Yes** | none | Store immediately, always, even when the address is unknown |
| Reverse geocoding (pin → address) | **No** | `nominatim.openstreetmap.org` | Make optional. Store `address_resolved = 0`; resolve on reconnect |
| Place search box (`searchPlaces`) | **No** | same host | Hide or disable the search field offline with a one-line explanation |
| Address display on cards/details | **Partially** | cached string | Show the cached address; when absent show `12.9716, 77.5946` — coordinates are a legitimate location label |
| Map basemap / satellite tiles | **No** | Google Maps tile servers | Show a neutral grid with a "Map imagery unavailable offline" chip. Do **not** block interaction |
| Map interaction (pan, zoom, center pin) | **Yes** | none — `react-native-maps` handles gestures locally | Works on a blank basemap; the centre pin still yields correct coordinates |
| Boundary drawing / editing | **Yes** | none (pure geometry) | Migrate the existing local-first store to SQLite |
| Boundary area / validation readout | **Yes** | `boundaryGeometry.ts` | No change |
| Polygon rendering over tiles | **Yes (geometry), degraded (context)** | tiles only for the backdrop | Render the polygon on the blank basemap; the shape is still meaningful |
| Field points seeding (monitoring) | **Yes** | derived from the boundary | Reconcile on sync by the `lat/lng` key `seedFieldPointsThunk` already uses |
| Live visit GPS streaming | **No** | `POST /visits/{id}/location` | Out of scope |

---

## 5. Should offline map tiles be added?

**Recommendation: no, not in this project.**

* `react-native-maps` with `PROVIDER_GOOGLE` has no supported offline-region API.
  Caching Google tiles to disk also runs into the Google Maps Platform terms.
* Doing it properly means swapping the whole map stack to a vector/raster engine
  with offline packs (MapLibre / Mapbox), plus a tile-pack download UI and hundreds
  of megabytes per region. That is a project of its own, and it would replace the
  boundary editor's entire rendering layer — the riskiest code in the app.
* The functional need is **coordinates and polygons**, and both work without tiles.
  The basemap is context, not data.

If the field team later reports that drawing a boundary on a blank canvas is
unusable in practice, the cheap middle path is: cache a **static satellite image**
of the field's bbox at boundary-creation time (one raster per field, stored via
`react-native-fs`, which is already a dependency) and render it as a
`react-native-maps` overlay when offline. That is a bounded feature, not a map-stack
migration. `REQUIRES PRODUCT DECISION`.

---

## 6. Permission behaviour (both platforms)

| | Android | iOS |
|---|---|---|
| Declared | `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION` (`AndroidManifest.xml`) | `NSLocationWhenInUseUsageDescription`, `NSLocationAlwaysAndWhenInUseUsageDescription` (`Info.plist`) |
| Requested at | first `getCurrentLocation()` call | same |
| Denied | `LocationError('permission_denied')` → dialog, retry possible | mapped to `permission_blocked` → dialog with Open Settings |
| Blocked / never-ask-again | `permission_blocked` → Open Settings deep link | same |
| Services off | `location_services_disabled` → `LOCATION_SOURCE_SETTINGS` intent | `Linking.openSettings()` |
| Affected by connectivity | **No** | **No** |

Permissions are entirely device-level. Nothing here changes offline, and none of it
needs modification for the offline project.
