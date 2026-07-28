# FLOW — the runtime lifecycle, in order

[ARCHITECTURE.md](./ARCHITECTURE.md) answers *where code lives*. This document
answers ***when things happen***, because almost every remaining class of map bug
is an ordering bug: something ran before the thing it depended on existed.

---

## 1. Application launch → first tile

```
┌── STAGE 1 · PROCESS START ────────────────────────────────────────────────┐
│                                                                           │
│  Android                          iOS                                     │
│  ───────                          ───                                     │
│  Zygote forks the process         UIApplicationMain                        │
│  MainApplication.onCreate()       AppDelegate.didFinishLaunching…          │
│  Play Services availability                                               │
│    resolved lazily by the SDK                                             │
└───────────────────────────────────────────────────────────────────────────┘
                                     │
┌── STAGE 2 · NATIVE SDK AUTHORISATION ─────────────────────────────────────┐
│                                                                           │
│  Android: NOTHING RUNS.                iOS: configureGoogleMaps()          │
│  The key is declarative — the SDK        ├─ Bundle.main["GMSApiKey"]      │
│  reads com.google.android.geo.API_KEY    ├─ empty? NSLog + return         │
│  from the merged manifest the first      └─ GMSServices.provideAPIKey()   │
│  time a MapView is constructed.                                           │
│                                        ← MUST be the FIRST statement.     │
│                                          One shot, process-wide, no retry.│
└───────────────────────────────────────────────────────────────────────────┘
                                     │
┌── STAGE 3 · REACT NATIVE STARTUP ─────────────────────────────────────────┐
│  factory.startReactNative(…)  /  MainActivity → ReactActivityDelegate     │
│  → Hermes boots, the JS bundle is evaluated                               │
│  → `@env` values are ALREADY INLINED as literals (Babel did this at build │
│     time — there is no runtime .env read)                                 │
│  → src/config/env.ts freezes `Env`                                        │
│  → RootNavigator mounts                                                   │
└───────────────────────────────────────────────────────────────────────────┘
                                     │
┌── STAGE 4 · A MAP SCREEN MOUNTS ──────────────────────────────────────────┐
│  <AppMapView> renders → react-native-maps creates the native view         │
│    Android: MapView (Play Services) inside a Fabric host view             │
│    iOS:     GMSMapView                                                    │
│  initialRegion is applied — the map opens there, no animation             │
└───────────────────────────────────────────────────────────────────────────┘
                                     │
┌── STAGE 5 · SDK AUTHENTICATION ───────────────────────────────────────────┐
│  The SDK makes an authenticated call with the key + app identity:         │
│    Android → package name + signing certificate SHA-1                     │
│    iOS     → bundle identifier                                            │
│  Google validates: key exists · API enabled · billing on · restrictions   │
│  match the caller.                                                        │
│                                                                           │
│  FAILURE HERE IS SILENT ON SCREEN — the map stays grey and the reason     │
│  appears only in logcat / the Xcode console. See TROUBLESHOOTING.md.      │
└───────────────────────────────────────────────────────────────────────────┘
                                     │
┌── STAGE 6 · TILE LOADING ─────────────────────────────────────────────────┐
│  Tiles are requested for the visible pyramid level, decoded, cached on    │
│  disk by the SDK, and composited.                                         │
│  customMapStyle is applied to the VECTOR base map here.                   │
│    → ignored when mapKind is 'satellite' or 'hybrid' (raster imagery)     │
└───────────────────────────────────────────────────────────────────────────┘
                                     │
┌── STAGE 7 · onMapReady ───────────────────────────────────────────────────┐
│  The native surface signals readiness → AppMapView `onReady`              │
│  → useMapCamera sets isReady = true                                       │
│  → ANY BUFFERED CAMERA COMMAND IS REPLAYED NOW                            │
│                                                                           │
│  ⚠ Camera calls made before this point are DROPPED by the SDK. That is    │
│    the entire reason useMapCamera exists.                                 │
└───────────────────────────────────────────────────────────────────────────┘
                                     │
┌── STAGE 8 · CHILDREN RENDER ──────────────────────────────────────────────┐
│  <MapMarker> / <MapPolyline> attach to the native map.                    │
│  Markers with custom children rasterise their view to a bitmap while      │
│  tracksViewChanges is true, then freeze when it flips to false.           │
└───────────────────────────────────────────────────────────────────────────┘
                                     │
┌── STAGE 9 · INTERACTIVE ──────────────────────────────────────────────────┐
│  Gestures, region events, camera animations. Steady state.                │
└───────────────────────────────────────────────────────────────────────────┘
```

### The three ordering traps

1. **iOS authorisation must precede the first `GMSMapView`.** It is a
   process-wide singleton with no retry. Calling `provideAPIKey` later does not
   fix maps that already failed — only a relaunch does.
2. **Camera commands must follow `onMapReady`.** Buffered by `useMapCamera`.
3. **`.env` is read at BUILD time, not launch time.** Changing it and reloading
   the app changes nothing. Metro `--reset-cache` (JS), a Gradle build (Android),
   `pod install` (iOS).

---

## 2. Location picker — full interaction lifecycle

```
 MOUNT
   │  selected ← props.initial (may be null)
   │  <AppMapView initialCenter={initial} initialZoom={PLACE}>
   ▼
 STAGE 7 fires → isReady = true
   │
   ├─ initial provided?  ── yes ──► nothing further; the map already opened there
   │                                (no animation — animating in from the country
   │                                 view would read as a glitch)
   │
   └─ no ──► auto-locate, SILENTLY
              │  getCurrentLocation()
              │    ├─ Android: PermissionsAndroid.request(ACCESS_FINE_LOCATION)
              │    └─ iOS:     Geolocation.requestAuthorization()
              │  then: low-accuracy attempt (12 s, 60 s cache tolerance)
              │        → on failure, high-accuracy attempt (20 s, no cache)
              │
              ├─ success → camera.animateToCoordinate(fix, PRECISE)
              └─ failure → stay on the default region. NO alert: the user can
                           still pick manually, and an unprompted permission
                           error on screen entry is hostile.
                           permission_blocked / services_disabled are remembered
                           in pendingRetryRef.

 USER PANS
   │  onRegionChange (continuous) → first one only → pin lifts
   │  onRegionChangeComplete      → pin drops, centre rounded to 6 dp
   ▼
 isSameSpot(previous, next, 2e-5)?
   ├─ yes → previous object identity kept → the geocode effect does NOT re-run
   └─ no  → setSelected(next)
              │  600 ms debounce, AbortController on the previous request
              ▼
           reverseGeocode()  (Nominatim)
              ├─ ok    → footer shows title / subtitle; Confirm enables
              └─ error → footer shows the error; a Retry button replaces Confirm

 USER TAPS GPS
   │  same acquisition as auto-locate, but LOUD:
   │  failures raise an Alert with an actionable path
   │  (Open Settings / Open Location Settings)
   ▼
 USER RETURNS FROM SETTINGS
   │  AppState 'active' + pendingRetryRef → silent retry
   ▼
 USER TYPES A SEARCH
   │  ≥ 3 characters, 500 ms debounce, abortable
   │  searchPlaces() → suggestion list
   │  tap → camera.animateToCoordinate(place, PLACE)
   │       → the normal region-change path produces the canonical address
   ▼
 USER TAPS CONFIRM
   │  gated on: pin AND resolved address AND not loading AND map ready
   │  Coordinates ALONE are never accepted — an unverifiable coordinate in the
   │  database is worse than no coordinate.
   ▼
 onConfirm({ latitude, longitude, address })
```

### Why errors use `Alert`, not the app toast
The picker renders inside a native `<Modal>`, which is a separate window on both
platforms. The app's root-level `GlobalToast` renders **behind** it and is
invisible. `Alert` is presented by the OS, above everything.

---

## 3. Live visit tracking — update lifecycle

```
 socket "location"  (several times per minute)
        │
        ▼
 screen setState: assessor = { latitude, longitude }
        │
        ├──────────────► MapMarker coordinate prop
        │                The SDK moves the marker natively.
        │                tracksViewChanges is already false — no re-rasterise.
        │
        └──────────────► useRouteToDestination
                              │
                     first fix? ──yes──► request immediately
                              │
                     moved > 40 m from the route's origin
                     AND > 8 s since the last request?
                              ├─ no  → reuse the current polyline
                              └─ yes → abort any in-flight request
                                       fetchDrivingRoute()
                                            ├─ 200 OK  → decodePolyline → solid line
                                            │            + "4.2 km · 11 min away"
                                            └─ null    → KEEP the previous route
                                                         if one exists; otherwise
                                                         dashed [origin,destination]
                                                         + haversine distance
        │
        ▼
 camera follow
    moved > 150 m since the last framing? → fitToCoordinates([assessor, dest])
    otherwise: leave the camera alone. The user may be reading the map.
```

### Unmount
Both effects abort their in-flight `AbortController`s. The marker-settling
timeout is cleared. No `setState` fires after unmount, so no leak warning.

---

## 4. Field preview inside a scrolling page

```
 finger down on the map
   │  wrapper View onTouchStart  → screen sets mapPanning = true
   │                             → the parent ScrollView freezes
   ▼
 finger drags → the native map pans; the page does not
   │
   ▼
 finger up / gesture cancelled
   │  onTouchEnd / onTouchCancel → mapPanning = false → the page scrolls again
```

**Why the callbacks are on the wrapper `View`, not the map:** on iOS the map's
own gesture recogniser consumes touches before React Native's responder system
observes them, so handlers attached to the map itself never fire. The wrapper
sees the touch first.

---

## 5. Cold start vs warm start

| | Cold start | Warm start (screen re-entry) |
|---|---|---|
| SDK authorisation | Runs (iOS) / first MapView (Android) | Already done |
| Tile fetch | Network | Mostly the SDK's disk cache |
| `onMapReady` delay | 300–1200 ms on a mid-range device | 50–200 ms |
| Camera buffering | **Frequently needed** | Rarely needed |

This asymmetry is why camera bugs "only happen on the tester's phone": on a warm
start with a fast device, `onMapReady` beats the first camera call and the missing
buffer is invisible.
