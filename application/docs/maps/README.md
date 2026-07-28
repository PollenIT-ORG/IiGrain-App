# Google Maps Integration — iiGrain Mobile

**Status:** Live · **Owner:** Mobile platform · **Last reviewed:** 2026-07-23

This folder is the permanent knowledge base for everything map-related in the
React Native application. It is written for a developer who joins the project in
six months, opens `src/maps/`, and needs to understand not just *what* the code
does but *why every one of these decisions was made*.

| Document | Read it when |
|---|---|
| [README.md](./README.md) | You want the decision record: why Google, why `react-native-maps`, why not Leaflet. |
| [SETUP.md](./SETUP.md) | You are setting the project up on a new machine, or a map is blank. |
| [CONFIGURATION.md](./CONFIGURATION.md) | You are touching any config file and need to know what breaks if you get it wrong. |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | You are adding a map feature and need to know where code goes. |
| [FLOW.md](./FLOW.md) | You are debugging *when* something happens — startup ordering, camera timing. |
| [BEST_PRACTICES.md](./BEST_PRACTICES.md) | **Before writing any map code.** The rules, why each exists, and how to reuse `MapExplorer` instead of copying it. |
| [SECURITY.md](./SECURITY.md) | Before every release. Non-negotiable checklist. |
| [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) | A map is grey, blank, unstyled, or a marker is missing. |
| [FUTURE_SCOPE.md](./FUTURE_SCOPE.md) | You are planning GIS work — polygons, boundaries, NDVI, offline. |
| [DECISION_LOG.md](./DECISION_LOG.md) | You are about to change or reverse an architectural choice. Read the ADR first — every trade-off is already written down. |
| [CHANGELOG.md](./CHANGELOG.md) | Always, when you change anything under `src/maps/` or the native map config. |

---

## 1. What this integration delivers

A single, typed, reusable map module (`src/maps/`) backed by the **native Google
Maps SDK on both Android and iOS**, replacing the previous Leaflet-in-a-WebView
implementation across every map surface in the product.

### Supported features today

| Feature | Where it is used | Component |
|---|---|---|
| Pin-drop location picker (search, GPS, reverse geocode) | Add Farm, Add Field | `LocationPicker`, `LocationPickerModal` |
| Read-only field location preview | Field Details → Overview | `FieldLocationPreview` |
| Live assessor→field tracking with road route + ETA | Farmer Visit Tracking, Assessor Visit | `VisitMap` |
| Browse + search + select any set of points | More → Help → Field Map | `MapExplorer` (domain-free, reusable) |
| Branded, muted base-map style | Everywhere | `config/mapStyle.ts` |
| Road/satellite/hybrid/terrain base maps | Field Map switcher; `mapKind` prop | `AppMapView` |
| Camera control that is safe before the map is ready | Everywhere | `useMapCamera` |
| Throttled Google Directions routing with straight-line fallback | `VisitMap` | `useRouteToDestination` |

### Supported platforms

| Platform | Renderer | Minimum | Notes |
|---|---|---|---|
| Android | Google Maps Android SDK via Play Services | `minSdkVersion 24` | Requires Google Play Services on the device. |
| iOS | Google Maps iOS SDK (`GoogleMaps` pod, 9.4.0) | iOS 15.1 | Opt-in via the `react-native-maps/Google` subspec. |
| Web | *Not supported.* | — | The app is React Native CLI only; there is no web target. |

---

## 2. Business requirements this had to satisfy

These are the constraints the choice of stack was made against. They are recorded
here because a future "let's just switch to X" proposal has to satisfy all of
them, not just the one that prompted it.

1. **Farmland is rural.** Coverage, imagery recency and road data quality in
   agricultural India are the primary accuracy requirement — not urban POI data.
2. **A field is identified by a coordinate, and later by a boundary.** The
   product roadmap (see [FUTURE_SCOPE.md](./FUTURE_SCOPE.md)) requires polygon
   drawing, area calculation, GeoJSON import/export and satellite imagery. The
   map stack had to support those without a second migration.
3. **Assessor visits are tracked live.** A map showing a moving marker and a road
   route must sustain a smooth frame rate on a mid-range Android device for the
   full duration of a visit, on battery.
4. **Both platforms must look identical.** Support screenshots, QA and design
   review all assume one visual result. Divergence doubles the cost of every
   visual bug.
5. **Coordinates round-trip with the backend at NUMERIC(9,6).** The value the
   user confirms must be the value stored, and must re-open on exactly the same
   pin.

---

## 3. Why Google Maps

| Criterion | Google Maps | Apple MapKit | OpenStreetMap / Leaflet | Mapbox |
|---|---|---|---|---|
| Rural India road + imagery quality | **Best in class** | Weak outside metros | Highly variable, community-dependent | Vector base is OSM-derived |
| Satellite / hybrid imagery | Included | iOS only | Not included — needs a paid tile source | Included |
| Cross-platform parity | One SDK, both platforms | iOS only | Same HTML, but not native | Both platforms |
| Live routing + ETA | Directions API | MapKit Directions (iOS only) | Public OSRM demo server, no SLA | Directions API |
| Cost at our volume | Monthly free tier then metered | Free | Free (tiles: fair-use policy) | Metered |
| Team familiarity | High | Low | High | Low |

**Decision:** Google Maps. The deciding factors were rural data quality
(requirement 1), bundled satellite imagery for the GIS roadmap (requirement 2),
and a single SDK giving cross-platform parity (requirement 4).

**Cost is the accepted trade-off.** Map loads are billed per SDK session. This is
budgeted, and the mitigations are documented in
[SECURITY.md](./SECURITY.md#7-cost-controls-are-a-security-control) — API
restrictions, quota caps and budget alerts are mandatory before release.

---

## 4. Why `react-native-maps`

`react-native-maps` v1.29.0.

- **It is the only mature option.** It is the de-facto standard React Native map
  binding, actively maintained, with support for the New Architecture — which
  this app has enabled (`newArchEnabled=true`, `RCTNewArchEnabled` in
  `Info.plist`). A binding without Fabric support would have been a blocker.
- **It wraps *both* native SDKs behind one component tree.** `<Marker>`,
  `<Polyline>`, `<Polygon>`, `<Geojson>`, `<Heatmap>` all exist already, so the
  GIS roadmap is prop work rather than native work.
- **It exposes the primitives we will need**: `customMapStyle` (branding),
  `fitToCoordinates` (framing), `tracksViewChanges` (the marker-performance
  escape hatch that makes live tracking viable), `mapType` (satellite/hybrid).
- **Writing our own bridge was considered and rejected.** Two native modules,
  two sets of gesture and lifecycle bugs, and no community to inherit fixes
  from — for no capability we do not already get.

Peer requirements met by this project: `react >= 18.3.1` (we have 19.2.3),
`react-native >= 0.76.0` (we have 0.84.1).

---

## 5. Why we are NOT using Leaflet

The app previously rendered every map with Leaflet + OpenStreetMap tiles inside
a `react-native-webview`. That code is gone (deleted in this change — see
[CHANGELOG.md](./CHANGELOG.md)). The reasons, in order of severity:

1. **It depended on two public CDNs at runtime.** Every map load fetched
   `unpkg.com/leaflet@1.9.4` and tiles from `tile.openstreetmap.org`. If either
   was slow, blocked by a corporate network, or the device was offline, the map
   was a grey rectangle with no recoverable error. The old code even had a
   `log('Leaflet failed to load — no internet / CDN blocked')` branch, which is
   an admission that this happened.
2. **OSM's tile usage policy forbids it.** `tile.openstreetmap.org` is explicitly
   not for production applications and may block heavy consumers without notice.
   We were one traffic spike away from every map in the product going grey.
3. **The WebView bridge was the wrong tool for a live map.** Every camera move
   was a serialised `injectJavaScript` string; every position update was a
   `JSON.parse` of a `postMessage`. On the visit-tracking screen that is a
   string round-trip per GPS tick, plus a full second JavaScript context and its
   memory, on top of Hermes.
4. **Routing ran through the public OSRM demo server** (`router.project-osrm.org`),
   which carries a "not for production use" notice and no availability guarantee.
5. **No satellite imagery, no polygon tooling worth the name.** Requirement 2
   would have needed a paid imagery tile source *and* a second migration.
6. **Gestures were emulated, not native.** Pan inertia, pinch behaviour and the
   two-scrollable-surfaces problem inside the Field Details page all behaved
   subtly differently from the rest of the app.

**What we kept from the Leaflet era, deliberately:** Nominatim (OpenStreetMap's
geocoder) still powers place search and reverse geocoding in
`src/services/geocoding.ts`. It is free, already integrated, already tuned, and
moving to Google Places is a separate decision with its own billing implications.
The interaction design — a fixed centre pin with a lifting shadow, save gated on
a resolved address — was ported deliberately, because it was good.

---

## 6. Why iOS uses Google, not Apple Maps

`react-native-maps` on iOS defaults to Apple MapKit. We explicitly opt in to
Google via the `react-native-maps/Google` CocoaPods subspec. Reasons:

- `customMapStyle` — our entire brand map style — is **silently ignored** by
  Apple MapKit. Choosing Apple means either dropping the styling or maintaining
  two visual designs.
- Marker anchoring, gesture inertia and callout behaviour differ between the two
  renderers. Every visual bug would need reproducing twice.
- Satellite imagery, terrain and (later) heatmaps behave differently.

The cost of this decision is honest and worth stating: a larger iOS binary
(~5–8 MB for the GoogleMaps framework) and iOS map loads being billed. It is
recorded here so a future team can revisit it with the trade-off in front of them.

---

## 7. Future scalability

The module was built so the following do **not** require re-architecting — see
[FUTURE_SCOPE.md](./FUTURE_SCOPE.md) for the full list:

- All vendor types are hidden behind `src/maps/types.ts`, so a renderer swap
  touches `src/maps/components/` only.
- All map children go through `MapPrimitives.ts`, so adding `Polygon`,
  `Geojson`, `Heatmap` or tile overlays is one export plus a documented reason.
- All tuning constants are in `config/mapDefaults.ts`, all styling in
  `config/mapStyle.ts`.
- Routing sits behind `services/directionsService.ts` with a single
  `DIRECTIONS_BASE_URL` constant, so moving it behind our own backend proxy —
  the top security item — is a one-line change.
