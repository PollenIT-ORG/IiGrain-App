# TROUBLESHOOTING — every map failure, and how to tell them apart

Map failures are almost all **silent**: you get a grey rectangle, not an
exception. The diagnosis is therefore always the same shape — *read the native
log*, because that is the only place the reason appears.

---

## 0. Start here — how to read the log

**Android**

```sh
adb logcat | grep -Ei "Google Maps|gms|Authorization|API key|maps"
```

**iOS** — Xcode console, or:

```sh
xcrun simctl spawn booted log stream --predicate 'process == "iiGrain"' --level debug
```

**JavaScript / Directions**

```sh
npx react-native log-android   # or log-ios
```

### 30-second triage

| What you see | Jump to |
|---|---|
| Grey grid with a Google watermark | [#1](#1-grey-map--blank-grey-grid-with-a-google-logo) |
| Completely blank, no watermark | [#2](#2-blank-white--black-map-area) |
| `Authorization failure` in logcat | [#3](#3-authorization-failure-android) |
| `must be initialized via provideAPIKey` | [#4](#4-google-maps-sdk-for-ios-must-be-initialized) |
| Manifest still shows `${MAPS_API_KEY}` | [#5](#5-no-placeholder-substitution-manifest-still-shows-maps_api_key) |
| Build fails at manifest merging | [#6](#6-manifest-merger-failed) |
| `Google Play services is missing` | [#7](#7-google-play-services-missing--out-of-date) |
| `REQUEST_DENIED`, `API not enabled` | [#8](#8-api-not-enabled) |
| `BillingNotEnabledMapError` | [#9](#9-billing-not-enabled) |
| iOS map looks like Apple Maps | [#10](#10-ios-renders-apple-maps-instead-of-google) |
| Marker missing / an empty square | [#11](#11-marker-invisible-or-renders-as-a-blank-square) |
| Custom marker invisible **on iOS only**, plain pins fine | [#11 Cause E](#cause-e--ios--new-architecture--provider_google-a-marker-with-children-never-renders) |
| Polygon frozen — moving a point does not reshape it (iOS) | [#19](#19-polygon-does-not-update-when-a-coordinate-moves-ios) |
| Camera does not move | [#12](#12-camera-not-moving) |
| Location permission problems | [#13](#13-permission-denied) |
| GPS never returns a fix | [#14](#14-location-unavailable--times-out) |
| No route line | [#15](#15-route-line-missing-or-always-dashed) |
| Styling ignored | [#16](#16-custom-map-style-has-no-effect) |
| Map fights the page scroll | [#17](#17-map-steals-the-page-scroll-gesture) |
| `.env` change had no effect | [#18](#18-env-change-did-not-take-effect) |

---

## 1. Grey map — blank grey grid with a Google logo

**Cause.** The SDK loaded and rendered its frame, but tile requests were rejected.
The Google watermark is the tell: **the SDK is alive, authentication failed.**

**Reason.** One of: no key, wrong key, key restricted to a different
package/SHA-1/bundle id, the Maps SDK API not enabled, or billing off.

**Solution.** Work down the chain, in order:

1. Read logcat / the Xcode console — the SDK states the exact reason.
2. Verify the key reached the binary:
   ```sh
   # Android
   grep -A1 "geo.API_KEY" \
     android/app/build/intermediates/merged_manifests/debug/processDebugManifest/AndroidManifest.xml
   # iOS
   /usr/libexec/PlistBuddy -c "Print :GMSApiKey" \
     ~/Library/Developer/Xcode/DerivedData/iiGrain-*/Build/Products/Debug-iphonesimulator/iiGrain.app/Info.plist
   ```
3. Confirm in Cloud Console: API enabled, billing enabled, restrictions match.
4. As a **temporary** diagnostic only, set the key's application restriction to
   "None". If the map appears, the restriction is wrong (usually the SHA-1).
   **Restore the restriction immediately.**

**How to debug faster.** Grey on one platform only isolates it to that platform's
chain ([ARCHITECTURE.md §1.4](./ARCHITECTURE.md#14-failure-isolation-table)). Grey
on both means the key, the API, or billing.

---

## 2. Blank white / black map area

**Cause.** No native map view exists at all — this is a layout or linking
failure, not an authentication one.

**Reason & solution.**

| Reason | Check | Fix |
|---|---|---|
| Container has zero height | Does the parent have `flex: 1` or an explicit height? | `AppMapView` fills its container; the container must have a size. |
| Native module not linked | `npm ls react-native-maps` | Reinstall; `pod install`; rebuild. A JS-only reload never links native code. |
| Metro serving a stale bundle | — | `npx react-native start --reset-cache` |
| Pods not installed after adding the dependency | `ls ios/Pods/GoogleMaps` | `cd ios && pod install` |

---

## 3. Authorization failure (Android)

```
E/Google Maps Android API: Authorization failure.
E/Google Maps Android API: Ensure that the "Maps SDK for Android" is enabled.
E/Google Maps Android API: Failed to load map. Error contacting Google servers.
```

Logcat prints the exact `Android Application (<cert_fingerprint>;<package_name>)`
pair it sent — **copy that line**. It is the ground truth for what to register.

**Solution.** Register that exact fingerprint + package pair on the key in Cloud
Console (Application restrictions → Android apps).

**The classic version of this bug:** maps work in internal testing and are blank
for Play Store users. Cause: only the *upload* key SHA-1 was registered, but
Google re-signs the app. Register the **App signing key certificate** SHA-1 from
Play Console → Setup → App signing. See
[SECURITY.md §3.2](./SECURITY.md#32-application-restrictions--android).

---

## 4. `Google Maps SDK for iOS must be initialized`

```
Google Maps SDK for iOS must be initialized via [GMSServices provideAPIKey:...]
```

**Cause.** A `GMSMapView` was constructed before `provideAPIKey` ran.

**Reason.** `configureGoogleMaps()` is missing from
`didFinishLaunchingWithOptions`, is not its first statement, or returned early
because `GMSApiKey` was empty.

**Solution.**
1. Look for `[Maps] GMSApiKey is empty` in the console — that is our own warning
   and means the key never reached the plist. Go to [#5](#5-no-placeholder-substitution-manifest-still-shows-maps_api_key)'s iOS half.
2. Otherwise confirm `configureGoogleMaps()` is the first line of
   `didFinishLaunchingWithOptions`.

**Note:** this is unrecoverable within the process. Fixing the key without
relaunching will not bring the maps back.

---

## 5. No placeholder substitution (manifest still shows `${MAPS_API_KEY}`)

**Android**

*Cause.* `defaultConfig.manifestPlaceholders["MAPS_API_KEY"]` is not being set.

*Check.*
```sh
cd android && ./gradlew :app:processDebugManifest --info | grep -i maps
```
Look for our warning `⚠️ MAPS_API_KEY is not set`.

*Reasons and fixes.*
- `.env` missing or the variable empty → add it.
- `.env` in the wrong place → it must be `application/.env`; Gradle resolves it
  as `rootProject.file("../.env")` where `rootProject` is `android/`.
- Someone replaced `manifestPlaceholders["X"] = …` with
  `manifestPlaceholders = [X: …]` → that also drops React Native's
  `usesCleartextTraffic` and breaks the merge. Restore the single-key form.

**iOS** — the plist shows the literal `$(MAPS_API_KEY)`.

*Cause.* The xcconfig include is missing, so the build setting does not exist and
Xcode leaves the token unexpanded.

*Check.*
```sh
cat ios/Config/Env.generated.xcconfig
grep -l "Env.generated.xcconfig" "ios/Pods/Target Support Files/Pods-iiGrain/"*.xcconfig
```

*Fix.* `cd ios && pod install`, then **Product → Clean Build Folder (⇧⌘K)** and
rebuild. Info.plist expansion is cached aggressively.

---

## 6. Manifest merger failed

```
Manifest merger failed : Attribute meta-data#com.google.android.geo.API_KEY@value
requires a placeholder substitution but no value for <MAPS_API_KEY> is provided.
```

**Cause.** The manifest references a placeholder Gradle never defined.

**Reason.** `manifestPlaceholders["MAPS_API_KEY"]` was removed from
`defaultConfig`, or the `resolveMapsApiKey()` block was lost in a merge.

**Solution.** Restore both halves — see
[CONFIGURATION.md §6](./CONFIGURATION.md#6-androidappbuildgradle). Note the value
may legitimately be an empty string; it must merely *exist*.

**Debug tip.** The full merge report is at
`android/app/build/outputs/logs/manifest-merger-debug-report.txt` and shows every
element's provenance.

---

## 7. Google Play services missing / out of date

```
W/GooglePlayServicesUtil: Google Play services is missing.
```

**Cause.** The Maps Android SDK is a Play Services client library; without Play
Services on the device there is no renderer.

**Reason.** Nearly always an **AOSP emulator image**. Occasionally a de-Googled
device (LineageOS, some Huawei models), or a genuinely outdated Play Services.

**Solution.**
- Emulator: recreate the AVD with a **"Google Play"** or **"Google APIs"** system
  image. This is the single most common new-developer report.
- Real device: update Google Play services from the Play Store.
- The `com.google.android.gms.version` meta-data in our manifest is what triggers
  the SDK's built-in "update Play services" dialog — do not remove it.

**Product note.** Devices without Play Services cannot render Google maps at all.
If that market matters, it is a stack decision, not a bug fix — see
[FUTURE_SCOPE.md](./FUTURE_SCOPE.md).

---

## 8. API not enabled

```
"status": "REQUEST_DENIED",
"error_message": "This API project is not authorized to use this API."
```

**Cause.** The specific API is not enabled on the Cloud project. Enabling *Maps
SDK for Android* does not enable *Maps SDK for iOS* or *Directions API* — they
are three separate switches.

**Solution.** Cloud Console → APIs & Services → Library → enable all three. Then
wait: propagation can take a few minutes.

**Debug.** Isolate with curl, outside the app:
```sh
curl "https://maps.googleapis.com/maps/api/directions/json?origin=20.59,78.96&destination=20.60,78.97&key=YOUR_KEY"
```
`error_message` names the exact problem.

---

## 9. Billing not enabled

```
E/Google Maps Android API: Authorization failure … BillingNotEnabledMapError
```

**Cause.** Google Maps Platform requires an active billing account **even inside
the free tier**.

**Solution.** Cloud Console → Billing → link a billing account to the project.
Then set budget alerts before you forget —
[SECURITY.md §7](./SECURITY.md#7-cost-controls-are-a-security-control).

---

## 10. iOS renders Apple Maps instead of Google

**Symptom.** The iOS map works, but the styling is ignored, the fonts and roads
look like iOS Maps, and it does not match Android.

**Cause.** `react-native-maps` compiled its default `Maps` subspec. Its build
script found no `$PODS_ROOT/GoogleMaps` and wrote `#define HAVE_GOOGLE_MAPS 0`,
so `provider={PROVIDER_GOOGLE}` **silently falls back to Apple MapKit**.

**Reason.** The Podfile is missing
`pod 'react-native-maps/Google', :path => '../node_modules/react-native-maps'`,
or it is declared after `use_react_native!`.

**Solution.**
```sh
cd ios && rm -rf Pods Podfile.lock && pod install
```
Confirm the output contains `Installing GoogleMaps (9.4.0)` and
`Installing Google-Maps-iOS-Utils (6.1.0)`.

**Why this is the most dangerous failure in the integration:** nothing errors.
It is only caught by looking at the two platforms side by side, which is why it
is step 1 and 7 of the [SETUP.md verification checklist](./SETUP.md#6-end-to-end-verification-checklist).

---

## 11. Marker invisible or renders as a blank square

**Cause A — anchoring.** A custom marker child is positioned by its `anchor`.
The SDK default `(0.5, 1.0)` assumes a bottom-centred pin bitmap. A circular
badge needs `(0.5, 0.5)`, or it sits half a badge above its coordinate.

**Cause B — `tracksViewChanges`.** A marker with React children must rasterise
that view into a bitmap. With `tracksViewChanges={false}` set from the very first
render, Android frequently captures an empty frame → a blank square.

*Fix, and the pattern used in `VisitMap`:* start `true`, flip to `false` after
~600 ms (`useSettledMarker`). Long enough for icon fonts to lay out, short enough
that the per-frame cost is not paid for the session.

**Cause C — z-order.** Overlapping markers: set `zIndex` explicitly. `VisitMap`
gives the live assessor `zIndex={2}` so it stays above the destination.

**Cause D — invalid coordinate.** `NaN`, `undefined`, or out-of-range values
render nothing and log nothing. Guard with `isValidLatLng()` — every component in
this module already does.

#### Cause E — iOS + New Architecture + `PROVIDER_GOOGLE`: a marker with children never renders

**Symptom.** Platform-split, and total: on Android the marker is perfect; on iOS
it is not faint or mispositioned, it is *absent*. `<Polygon>`, `<Polyline>` and
plain `<Marker coordinate title />` pins on the same map all draw correctly, so
the key, the provider and the tiles are demonstrably fine. Because the marker is
also zero-sized it is un-tappable and un-draggable — the screen looks like its
touch handling is broken, which sends you hunting in the wrong place.

**Cause.** In react-native-maps 1.29 the Fabric marker for Google-on-iOS
(`RNMapsGoogleMarkerView`) wraps the legacy `AIRGoogleMapMarker`, and that view
is never inserted into a UIView hierarchy — `AIRGoogleMap.insertReactSubview`
only appends it to a `_reactSubviews` array. So `layoutSubviews` never runs, and
`didUpdateReactSubviews` (a Paper-only callback) is never called either. Both are
the only places that size `GMSMarker.iconView`, the container the React children
are mounted into. It keeps a zero frame, and once `tracksViewChanges` flips to
`false` the SDK snapshots that zero-sized view. Nothing to draw, nothing to hit.

Apple MapKit on iOS is *not* affected — `RNMapsMarkerView` handles children
correctly — which is a useful confirmation test.

**How to confirm in 60 seconds.** Put three markers on one Google map: a plain
pin, a child-marker with `tracksViewChanges`, and a child-marker that settles to
`false`. Only the plain pin appears.

**Solution.** Do not put React children inside a `<Marker>` on iOS. The Farm
Boundary editor draws its handles as a screen-space overlay above the map
instead — `src/maps/boundary/components/BoundaryHandleLayer.tsx`, selected by
`USE_OVERLAY_HANDLES` in `boundaryConfig.ts`. It projects each coordinate with
the live region and renders plain RN views, so it is immune to the SDK's marker
plumbing. See ADR-B09 in
[FarmBoundary/DECISION_LOG.md](./FarmBoundary/DECISION_LOG.md).

**Still on native markers, and iOS-blind:** `VisitMap`, `SamplePointsMap` and
`FieldLocationPreview` all pass children to `<Marker>`. They are subject to the
same bug and need the same treatment (or a patched pod) before their pins can be
trusted on iOS.

---

## 12. Camera not moving

**Cause.** `animateToRegion` / `fitToCoordinates` called before the native map
signalled `onMapReady`. The SDK silently drops them.

**Why it "works on my machine":** on a warm start with a fast device the map is
ready before your call. It fails on cold starts and mid-range hardware.

**Solution.** Use `useMapCamera` — it buffers the last command and replays it on
ready. Never hold a raw ref and call it directly.

```ts
const { mapRef, onMapReady, camera } = useMapCamera();
…
<AppMapView ref={mapRef} onReady={onMapReady} … />
camera.animateToCoordinate(coord, MAP_ZOOM.PRECISE);   // safe at any time
```

**Other causes.**
- `fitToCoordinates([])` — an empty array is a no-op. Filter with `isValidLatLng`.
- A degenerate single-point region: handled by `MIN_SPAN` in
  `regionContaining()`; without it the map zooms past the imagery level and
  renders grey.
- Something re-renders `region` as a controlled prop — do not; see
  [ARCHITECTURE.md §2.5](./ARCHITECTURE.md#25-why-the-camera-is-imperative).

---

## 13. Permission denied

**Cause.** Location permission not granted, or permanently blocked.

`src/services/currentLocation.ts` maps every native outcome to an actionable
code; `LocationPicker` renders the matching recovery path:

| Code | Meaning | What the UI does |
|---|---|---|
| `permission_denied` | Soft "not now" | Explains; user can still pick manually |
| `permission_blocked` | Never-ask-again / iOS denied | Offers **Open Settings** |
| `location_services_disabled` | Device GPS is off | Offers **Open Location Settings** (Android intent) |
| `timeout` | No fix in time | Suggests an open area, offers retry |
| `position_unavailable` | Everything else | Generic; manual pick still available |

**Checks.**
- Android: `ACCESS_FINE_LOCATION` + `ACCESS_COARSE_LOCATION` in the manifest ✅
- iOS: `NSLocationWhenInUseUsageDescription` in `Info.plist` ✅ — **iOS terminates
  the app** if this string is missing and location is requested.
- Returning from Settings auto-retries via the `AppState` listener.

**Note on the mapping:** the geolocation library reports a disabled provider on
Android as code `2` (`POSITION_UNAVAILABLE`), which is why code 2 maps to
`location_services_disabled` rather than to a generic failure.

---

## 14. Location unavailable / times out

**Cause.** No fix obtainable — indoors, urban canyon, cold GPS.

**How the code already handles it.** `getCurrentLocation()` makes two attempts
with different profiles: a fast cache-tolerant one (`enableHighAccuracy: false`,
12 s, 60 s cache) and then a precise one (`enableHighAccuracy: true`, 20 s, no
cache). A cached or network fix returns instantly when it exists; the GPS warm-up
cost is only paid when it does not.

**Solution.** Move outdoors. On an emulator, set a mock location (Extended
controls → Location on Android; Features → Location on the iOS simulator) — an
emulator with no location set never returns a fix.

**Never** switch this to `watchPosition`: a picker that streams fixes re-centres
on every GPS tick and looks like it is continuously refreshing. One-shot is
deliberate.

---

## 15. Route line missing or always dashed

**A dashed line is a valid state**, not necessarily a bug: it means "no road
route available, this is as the crow flies".

Diagnose in order:

| Check | Command / place | Meaning |
|---|---|---|
| Is the key present in JS? | `console.log(Env.MAPS_API_KEY)` in dev | Empty → `.env` + `--reset-cache` |
| Is Directions enabled? | curl from [#8](#8-api-not-enabled) | `REQUEST_DENIED` → enable it |
| Is there a road? | Try the same pair in Google Maps web | `ZERO_RESULTS` is genuine for remote farm tracks |
| Is the device online? | — | Offline → fallback, by design |
| Is it throttled? | `useRouteToDestination` | 40 m / 8 s. Fewer than 40 m of movement → no new request. **Expected.** |

Remember `fetchDrivingRoute` deliberately **never throws** — every failure
returns `null` so a live tracking screen cannot crash mid-visit.

---

## 16. Custom map style has no effect

| Cause | Explanation |
|---|---|
| `mapKind` is `satellite` or `hybrid` | `customMapStyle` only affects the **vector** base map. Raster imagery cannot be restyled. Google SDK behaviour, not a bug. |
| iOS is on Apple Maps | Apple MapKit ignores `customMapStyle` entirely → [#10](#10-ios-renders-apple-maps-instead-of-google). |
| A `googleMapId` is set | A cloud-based map ID **overrides** `customMapStyle`. This project sets no map ID; if one is added, the JSON style stops working. |
| Malformed style JSON | The SDK silently ignores an invalid array. Regenerate at <https://mapstyle.withgoogle.com/>. |

---

## 17. Map steals the page scroll gesture

**Symptom.** On Field Details, dragging over the map does not scroll the page, or
scrolling the page pans the map.

**Cause.** Two scrollable surfaces on the same axis competing for the gesture.

**Solution — the wiring that already exists.** The screen freezes its own
ScrollView while a finger is down on the map, driven by `onTouchStart` /
`onTouchEnd` / `onTouchCancel` on `FieldLocationPreview`'s **wrapper View**.

*Why the wrapper and not the map:* on iOS the map's own gesture recogniser
consumes touches before React Native's responder system sees them, so handlers
on the map itself never fire.

For a map that should never pan at all, pass `interactive={false}` to
`AppMapView`.

---

## 18. `.env` change did not take effect

This one catches everybody, once each.

| Consumer | When it reads `.env` | To pick up a change |
|---|---|---|
| JavaScript (`@env`) | Babel **transform** time; Metro caches the result | `npx react-native start --reset-cache` |
| Android (Gradle) | Gradle **configuration** time, every build | Just rebuild — automatic |
| iOS (CocoaPods) | **Only during `pod install`** | `cd ios && pod install`, then rebuild |

Editing `.env` and hot-reloading changes nothing anywhere. The iOS one is the
easiest to forget, because Android picks it up for free and it looks like the
edit worked.

---

## Appendix — one-line health check

```sh
# Android: is a key in the built manifest?
grep -A1 "geo.API_KEY" android/app/build/intermediates/merged_manifests/debug/processDebugManifest/AndroidManifest.xml

# iOS: is a key in the built app?
/usr/libexec/PlistBuddy -c "Print :GMSApiKey" ~/Library/Developer/Xcode/DerivedData/iiGrain-*/Build/Products/Debug-iphonesimulator/iiGrain.app/Info.plist

# iOS: was the Google subspec actually installed?
ls ios/Pods/GoogleMaps 2>/dev/null && echo "Google ✅" || echo "Apple Maps fallback ❌"

# Cloud: is the key + billing + API healthy?
curl -s "https://maps.googleapis.com/maps/api/directions/json?origin=20.59,78.96&destination=20.60,78.97&key=$MAPS_API_KEY" | head -c 400
```

---

## 19. Polygon does not update when a coordinate moves (iOS)

**Symptom.** Drawing works — every new point extends the shape. **Editing does
not**: drag a vertex and the handle moves while the outline stays exactly where
it was. Add or delete a point and the outline suddenly snaps to the correct
shape, catching up on every edit you made in between. It reads as "editing is
broken" or "the lines disappeared during edit", not as a rendering bug.

A `<Polyline>` over the identical coordinate array **does** follow. That
asymmetry is the tell.

**Cause.** `RNMapsGooglePolygonView.updateProps` rebuilds the `GMSMutablePath`
only when the coordinate **count** changes:

```objc
// ios/AirGoogleMaps/RNMapsGooglePolygonView.mm
if (newViewProps.coordinates.size() != oldViewProps.coordinates.size()) {
    GMSMutablePath *path = [GMSMutablePath path];
    …
    _view.path = path;
}
```

Moving a vertex changes the values, never the count — so the path is never
rebuilt. Drawing appends points, so the count changes on every tap and drawing
looks perfectly healthy. Android's renderer diffs the coordinates themselves and
is unaffected.

**Confirm it in 60 seconds.** One Google map, one `<Polygon>` and one
`<Polyline>` fed the *same* array, one corner animated on a timer. The polyline
moves; the polygon sits still.

**Solution.** Make the count differ on every update. `BoundaryPolygon` pads the
ring with one or two repeats of its last vertex — a zero-length closing segment
the SDK draws as nothing — picking the count so it can never equal the count it
sent last time, including across an insert or a delete. Android gets the ring
unpadded. See `src/maps/boundary/components/BoundaryPolygon.tsx` and ADR-B10.

**If you add a new polygon,** route it through `BoundaryPolygon` rather than
`MapPolygon` — otherwise it inherits the bug the moment its shape can change.
`VisitMap` still uses `MapPolygon` directly; that is safe only because its ring
is fixed for the life of the screen.
