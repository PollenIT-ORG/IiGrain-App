# ARCHITECTURE — how the map module is put together

Two architectures are described here, because they are genuinely separate and
confusing them is the source of most map bugs:

1. **The configuration architecture** — how an API key gets from a developer's
   machine into a rendering tile. Build-time, three toolchains.
2. **The code architecture** — how `src/maps/` is layered. Run-time, one module.

---

## Part 1 — Configuration architecture

### 1.1 The full chain, Android

```
 Developer
     │  writes MAPS_API_KEY=AIza… into
     ▼
 application/.env                            (gitignored, never committed)
     │
     │  read at Gradle CONFIGURATION time by
     ▼
 resolveMapsApiKey()  in android/app/build.gradle
     │    ├─ 1st choice: $MAPS_API_KEY process env   (CI / Play Console)
     │    ├─ 2nd choice: application/.env             (local developer)
     │    └─ fallback:   ""  + a loud warning
     │
     │  assigned to
     ▼
 defaultConfig.manifestPlaceholders["MAPS_API_KEY"]
     │
     │  substituted by the :app:processDebugManifest task
     ▼
 AndroidManifest.xml
   <meta-data android:name="com.google.android.geo.API_KEY"
              android:value="${MAPS_API_KEY}" />
     │
     │  packaged into the APK; read via PackageManager at process start
     ▼
 Google Maps Android SDK  (com.google.android.gms:play-services-maps)
     │
     │  authenticated HTTPS request for a tile pyramid
     ▼
 Google's tile servers
     │
     ▼
 Map tiles → GLSurfaceView → the user's screen
```

### 1.2 The full chain, iOS

```
 Developer
     │
     ▼
 application/.env
     │
     │  read by resolve_maps_api_key() — ONLY during `pod install`
     ▼
 ios/Podfile  post_install hook
     │
     │  writes
     ▼
 ios/Config/Env.generated.xcconfig        (gitignored)
   MAPS_API_KEY = AIza…
     │
     │  #include?-ed from the CocoaPods-generated xcconfigs, which are the
     │  app target's base configuration
     ▼
 Xcode build setting  MAPS_API_KEY
     │
     │  expanded during the "Process Info.plist" build phase
     ▼
 iiGrain.app/Info.plist
   <key>GMSApiKey</key><string>AIza…</string>
     │
     │  Bundle.main.object(forInfoDictionaryKey:)
     ▼
 AppDelegate.configureGoogleMaps()
     │
     │  GMSServices.provideAPIKey(apiKey)   ← process-wide, one shot
     ▼
 Google Maps iOS SDK  (GoogleMaps 9.4.0 pod)
     │
     ▼
 Map tiles → GMSMapView → the user's screen
```

### 1.3 The third chain — JavaScript (routing only)

```
 application/.env
     │
     │  inlined at BABEL TRANSFORM time by react-native-dotenv
     ▼
 the virtual `@env` module
     │
     ▼
 src/config/env.ts        Env.MAPS_API_KEY  (frozen, trimmed, defaulted to "")
     │
     ▼
 src/maps/services/directionsService.ts
     │
     │  HTTPS GET maps.googleapis.com/maps/api/directions/json?key=…
     ▼
 Directions API → encoded polyline + distance + duration
     │
     ▼
 decodePolyline() → LatLng[] → <MapPolyline>
```

**These three chains never meet.** Gradle cannot see Babel's output; CocoaPods
cannot see Gradle's; JavaScript cannot reach either native manifest. Every
"but the key is in `.env`, why is it blank?" question resolves to *which of the
three chains is broken*.

### 1.4 Failure isolation table

Use this to locate a break in one step.

| Symptom | Broken chain | Broken link |
|---|---|---|
| Android blank, iOS fine | Android | Gradle → manifest |
| iOS blank, Android fine | iOS | Podfile → xcconfig → Info.plist |
| Both blank | Shared | `.env` missing, or the key/billing/API is disabled in Cloud |
| Tiles fine, no route line | JS | `Env.MAPS_API_KEY` or Directions API not enabled |
| iOS shows Apple Maps styling | iOS | The `/Google` subspec is missing from the Podfile |
| Tiles fine, styling ignored | Neither | `mapKind` is satellite/hybrid, or iOS is on Apple Maps |

---

## Part 2 — Code architecture

### 2.1 Folder layout

```
src/maps/                        ← the module. One feature, one folder.
│
├── index.ts                     ← THE public surface. Screens import only this.
├── types.ts                     ← Domain vocabulary: LatLng, MapRegion, AppMapHandle…
│
├── config/
│   ├── mapDefaults.ts           ← Zoom tokens, durations, epsilons, padding
│   └── mapStyle.ts              ← Branded Google JSON style arrays
│
├── utils/                       ← Pure functions. No React, no vendor imports.
│   ├── geo.ts                   ← haversine, region maths, validation, formatting
│   └── polyline.ts              ← Google encoded-polyline decoder
│
├── services/
│   └── directionsService.ts     ← Google Directions API client
│
├── hooks/
│   ├── useMapCamera.ts          ← Camera control that is safe before onMapReady
│   └── useRouteToDestination.ts ← Throttled routing + straight-line fallback
│
└── components/
    ├── AppMapView.tsx           ← ★ the ONLY file importing MapView
    ├── MapPrimitives.ts         ← ★ the ONLY file importing Marker/Polyline/Callout
    ├── MapCenterPin.tsx         ← Fixed centre pin overlay
    ├── MapExplorer.tsx          ← Reusable: browse + search + select N points
    ├── LocationPicker.tsx       ← Feature: pin-drop picker
    ├── LocationPickerModal.tsx  ← Feature: the picker as a modal
    ├── FieldLocationPreview.tsx ← Feature: read-only field map
    └── VisitMap.tsx             ← Feature: live tracking + route
```

### 2.2a The four map surfaces, and which to reach for

They are deliberately separate components rather than one configurable map,
because each is a genuinely different *interaction* — not a different skin.

| Surface | Interaction | Reach for it when |
|---|---|---|
| `MapExplorer` | Browse N labelled points, search, tap one | A list of things that have locations: farms, fields, assessors, visits |
| `LocationPicker` | Move the map under a fixed centre pin | The user is **choosing** a coordinate |
| `FieldLocationPreview` | Read-only, one point | Showing where a single record is |
| `VisitMap` | Live position + road route + ETA | Tracking something that moves |

`MapExplorer` is the only one that is domain-free. It renders `MapEntity[]`, so
a new consumer costs a `useMemo` adapter and a few props — see
[BEST_PRACTICES.md §2](./BEST_PRACTICES.md#2-reusing-mapexplorer) and ADR-012.

```
        screens/farms         screens/help        screens/assessor  (future)
             │                     │                     │
        Farm[]                Farm[]                Assessor[]
             │                     │                     │
             ▼                     ▼                     ▼
      farmToEntity()        farmToEntity()      assessorToEntity()
             │                     │                     │
             └─────────────► MapEntity[] ◄───────────────┘
                                   │
                             <MapExplorer>
                                   │
                              <AppMapView>
```

### 2.2 Why a feature module and not the existing flat folders

The rest of `src/` is flat: `components/`, `hooks/`, `services/`, `config/`,
`types/`, `utils/`. Maps deliberately breaks that pattern, for one reason:

> **Cohesion beats consistency when a feature owns code in every layer.**

Spread flat, this integration would be nine files across five directories with
nothing naming them as one system. A developer asked to "add polygon support"
would have to find them. As a module, the answer to *"where does map code go?"*
is one word.

This is the project's first feature module. If a second one is created, this is
the shape to copy.

### 2.3 Layering rules

```
      screens/  ──────────────────┐   may import only  src/maps  (the barrel)
                                  ▼
                          src/maps/index.ts
                                  │
              ┌───────────────────┼───────────────────┐
              ▼                   ▼                   ▼
        components/            hooks/            config/ · utils/ · services/
              │                   │                   │
              ▼                   ▼                   │
      react-native-maps    (no vendor imports)   (no vendor imports*)
```

Enforced rules, in priority order:

1. **The one-import rule.** Only `AppMapView.tsx`, `MapPrimitives.ts` and
   `mapStyle.ts` (type-only) may `import … from 'react-native-maps'`. Everything
   else — including every screen — goes through `src/maps`.
2. **`utils/` is pure.** No React, no vendor imports, no I/O. This is what makes
   the maths unit-testable without a native module.
3. **`hooks/` owns policy, not rendering.** Throttling, buffering and camera
   sequencing live in hooks so two screens cannot drift apart.
4. **`config/` owns every magic number.** No inline `16`s or `600`s in JSX.

\* `mapStyle.ts` imports the `MapStyleElement` **type** only — erased at compile
time, no runtime coupling.

### 2.4 Why `AppMapView` exists

It is not a thin pass-through. It enforces five decisions that a call site must
not be able to get wrong:

| Enforced | Why |
|---|---|
| `provider={PROVIDER_GOOGLE}` — pinned, not a prop | Default on iOS is Apple MapKit, which ignores `customMapStyle`. One renderer, one set of bugs. |
| `customMapStyle` applied centrally | A style change lands everywhere at once. |
| Camera exposed imperatively via `AppMapHandle` | A controlled `region` prop fights the user: every pan re-renders with the old region and snaps back. |
| `toolbarEnabled={false}` | Google's Android toolbar deep-links out of our app mid-flow. |
| `rotateEnabled` / `pitchEnabled` off | No 3D requirement; both are easy to trigger accidentally while placing a pin. |

It also normalises native events into app vocabulary: `onCenterChange` hands
back a `LatLng` **already rounded to storage precision**, so a value passed
straight to the API is the value the user saw.

### 2.5 Why the camera is imperative

This is the least obvious design decision in the module, so it is worth stating
plainly.

```
❌ Controlled:  <MapView region={region} onRegionChange={setRegion} />
   user pans → onRegionChange → setState → re-render with the PREVIOUS region
   → the map snaps back. The map fights the finger.

✅ Uncontrolled + imperative:
   <AppMapView ref={mapRef} initialRegion={…} onCenterChange={…} />
   camera.animateToCoordinate(coord, MAP_ZOOM.PRECISE)
   The map owns its camera. We observe it, and move it on explicit intent
   (GPS button, search result, recentre).
```

`useMapCamera` adds one more guarantee on top: camera calls made **before**
`onMapReady` are buffered and replayed. Without it, a screen that already knows
its coordinate at mount silently never moves — a bug that reproduces on cold
starts and slow devices but not in development.

### 2.6 Data flow — the location picker

```
 user drags the map
        │
        ▼
 MapView onRegionChange (continuous)
        │
        ▼  first event only (movingRef guard)
 AppMapView → onCameraMoveStart → setMoving(true) → MapCenterPin lifts
        │
        ▼  map settles
 MapView onRegionChangeComplete
        │
        ▼  centre rounded to 6 dp
 AppMapView → onCenterChange(center)
        │
        ├─ setMoving(false) → pin drops
        │
        ▼  isSameSpot(prev, next, SAME_SPOT_EPSILON)?
      yes → keep the previous object identity → NO re-geocode
      no  → setSelected(next)
                    │
                    ▼  debounced 600 ms, AbortController-cancellable
             reverseGeocode()  (Nominatim)
                    │
                    ▼
             address → footer text → "Confirm" becomes enabled
                    │
                    ▼
             onConfirm({ latitude, longitude, address })
                    │
                    ▼
             screen → POST /farms/my  (NUMERIC(9,6))
```

The `SAME_SPOT_EPSILON` identity trick is the important part: without it, the
settle event after inertia fires a second geocode for a position ~0.2 m away,
and the footer flickers "Fetching location details…" on every pan.

### 2.7 Data flow — live visit tracking

```
 socket "location" event  ─────► screen state: assessor: LatLng
                                        │
                                        ▼
                        useRouteToDestination(assessor, destination)
                                        │
                    ┌───────────────────┴───────────────────┐
                    ▼                                       ▼
        moved > 40 m AND > 8 s since last?           otherwise: reuse
                    │                                the existing route
                    ▼
        abort any in-flight request
        fetchDrivingRoute(origin, destination)
                    │
            ┌───────┴────────┐
            ▼                ▼
        route found       null (offline / ZERO_RESULTS / no key)
            │                │
            ▼                ▼
     decodePolyline    keep the PREVIOUS route if there was one,
     → solid line       else [origin, destination] → dashed line
            │                │
            └───────┬────────┘
                    ▼
              <MapPolyline>
                    +
        badge: "4.2 km · 11 min away"   (route)
            or "3.8 km away"            (haversine fallback)
                    +
        camera re-frames only when the assessor has moved > 150 m
```

Three cost/UX decisions are encoded here:

- **40 m / 8 s throttle** — a billed API call per GPS tick would be thousands per
  visit; below that threshold the drawn line is still accurate at map scale.
- **A failed lookup never clears a good route** — driving through a tunnel must
  not make the road vanish.
- **150 m follow threshold** — GPS noise is 5–20 m; re-framing on noise would
  make the map twitch continuously.

### 2.8 Rendering layers, top to bottom

```
┌─────────────────────────────────────────────────┐
│  RN overlays  (siblings of the map, absolute)   │  ← MapCenterPin, search bar,
│  pointerEvents:"none" where they must not       │    GPS button, ETA badge,
│  steal touches                                  │    recentre button
├─────────────────────────────────────────────────┤
│  Map children  (move WITH the map)              │  ← MapMarker, MapPolyline
├─────────────────────────────────────────────────┤
│  Native map surface                             │  ← tiles + customMapStyle
└─────────────────────────────────────────────────┘
```

The distinction matters: **the centre pin is an overlay** (it must stay screen-
centred while the map moves under it), while **the field marker is a child** (it
must stay glued to its coordinate). Getting this backwards produces a pin that
slides off the target, or a marker that never moves.
