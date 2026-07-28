# SETUP — Google Maps, from zero to a rendering map

Follow this top to bottom on a new machine. Every step states its **expected
output** so you can tell a success from a silent failure — silent failure is the
normal mode for map misconfiguration, because a wrong key produces a *blank map*,
not an exception.

All paths are relative to `application/`.

---

## 0. Prerequisites

| Requirement | Check | Expected |
|---|---|---|
| Node | `node -v` | `>= 22.11.0` (see `package.json` → `engines`) |
| JDK 17 | `java -version` | `openjdk 17.x` |
| Android SDK 36 | Android Studio → SDK Manager | Platform 36, Build-Tools 36.0.0 |
| Xcode | `xcodebuild -version` | 15+ (iOS 15.1 deployment target) |
| CocoaPods | `pod --version` | 1.14+ |
| An Android device/emulator **with Google Play Services** | — | See the warning below |

> **Android emulator warning.** Choose a system image labelled
> *"Google Play"* or *"Google APIs"*. An **AOSP** image has no Play Services, so
> the Maps SDK cannot initialise and every map renders grey with
> `Google Play services is missing` in logcat. This is the single most common
> "the map is broken" report from new developers.

---

## 1. Google Cloud — create and enable the key

This is done **once per environment** (dev / staging / production — do not share
one key across them, see [SECURITY.md](./SECURITY.md)).

1. Open <https://console.cloud.google.com/> → select or create the project.
2. **Billing must be enabled on the project.** Without it every Maps API returns
   an authorisation failure even inside the free tier. This is the second most
   common cause of a blank map.
3. **APIs & Services → Library** — enable all three:

   | API | Needed for |
   |---|---|
   | **Maps SDK for Android** | Android tiles |
   | **Maps SDK for iOS** | iOS tiles |
   | **Directions API** | The route line + ETA on the visit-tracking screens |

4. **APIs & Services → Credentials → Create credentials → API key.**
5. **Restrict the key immediately** — do not skip this, do not "do it later".
   Full instructions in [SECURITY.md](./SECURITY.md#3-restricting-the-key). In
   short: Android → package `com.iigrain` + your SHA-1; iOS → bundle id
   `com.amitbaser.iigrain`.

**Expected output:** a key of the form `AIzaSy...`, ~39 characters.

**Verify the key works before touching the app** (this isolates a Cloud problem
from an app problem):

```sh
curl "https://maps.googleapis.com/maps/api/directions/json?origin=20.59,78.96&destination=20.60,78.97&key=YOUR_KEY"
```

- `"status": "OK"` or `"status": "ZERO_RESULTS"` → the key and billing are fine.
- `"status": "REQUEST_DENIED"` with `"error_message"` → read the message; it is
  almost always "API not enabled", "billing not enabled" or "key restricted".

> Note: a key restricted to Android/iOS apps will still return `REQUEST_DENIED`
> to `curl` — that is correct behaviour, not a fault. See
> [SECURITY.md §5](./SECURITY.md#5-the-directions-api-problem).

---

## 2. Install the JavaScript dependency

Already committed to `package.json`; this step is for a fresh clone.

```sh
cd application
npm install
```

The map dependency added by this integration:

```jsonc
"react-native-maps": "1.29.0"
```

**Why this package and no others:** see
[README.md §4](./README.md#4-why-react-native-maps). No companion packages were
added — geolocation (`@react-native-community/geolocation`), SVG
(`react-native-svg`) and HTTP (`axios`) were all already in the project and are
reused.

**Expected output:** `added N packages`. Verify:

```sh
npm ls react-native-maps
# iiGrain@0.0.1 C:\farmer-app\application
# └── react-native-maps@1.29.0
```

---

## 3. Put the key in `.env`

```sh
cp .env.example .env   # if you do not have one yet
```

Then set:

```dotenv
MAPS_API_KEY=AIzaSy...your key...
```

`.env` is gitignored. **Never commit it.** `.env.example` documents the variable
but must always hold an empty value.

**Why one variable feeds three consumers** (Gradle, CocoaPods, and Babel/JS) is
explained in [CONFIGURATION.md](./CONFIGURATION.md#1-env).

**Expected output:** none — this is a file edit. Verification happens at build
time, in steps 4 and 5.

---

## 4. Android configuration

Everything below is **already committed**. This section explains what it does so
you can verify it, and so you can fix it if a merge breaks it.

### 4.1 `android/app/build.gradle` — reads `.env`, produces a manifest placeholder

```gradle
def resolveMapsApiKey() { /* $MAPS_API_KEY, else application/.env, else "" */ }
def mapsApiKey = resolveMapsApiKey()

android {
  defaultConfig {
    manifestPlaceholders["MAPS_API_KEY"] = mapsApiKey
  }
}
```

### 4.2 `android/app/src/main/AndroidManifest.xml` — consumes it

```xml
<application …>
  <meta-data
      android:name="com.google.android.geo.API_KEY"
      android:value="${MAPS_API_KEY}" />
  <meta-data
      android:name="com.google.android.gms.version"
      android:value="@integer/google_play_services_version" />
</application>
```

### 4.3 `android/build.gradle` — pins the Play Services versions

```gradle
googlePlayServicesMapsVersion = "19.1.0"
googlePlayServicesBaseVersion = "18.5.0"
googlePlayServicesLocationVersion = "21.3.0"
```

### 4.4 Permissions

Already present from the previous location work — no change was needed:

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
```

### 4.5 Build and verify

```sh
npx react-native run-android
```

**Verification — confirm the key actually reached the merged manifest.** Do not
skip this; it is the only way to distinguish "no key" from "wrong key":

```sh
cd android
./gradlew :app:processDebugManifest
grep -A1 "com.google.android.geo.API_KEY" \
  app/build/intermediates/merged_manifests/debug/processDebugManifest/AndroidManifest.xml
```

**Expected output:**

```xml
<meta-data
    android:name="com.google.android.geo.API_KEY"
    android:value="AIzaSy..." />
```

- `android:value="${MAPS_API_KEY}"` (literally, unsubstituted) → the Gradle
  placeholder is not wired. See
  [TROUBLESHOOTING.md → No placeholder substitution](./TROUBLESHOOTING.md#5-no-placeholder-substitution-manifest-still-shows-maps_api_key).
- `android:value=""` → `.env` was not found or the variable is empty. Gradle also
  prints `⚠️  MAPS_API_KEY is not set` during configuration — scroll up in the
  build log.

---

## 5. iOS configuration

### 5.1 `ios/Podfile` — the Google subspec

```ruby
pod 'react-native-maps/Google', :path => '../node_modules/react-native-maps'
```

Declared **before** `use_react_native!`. Without it, `react-native-maps` compiles
its default `Maps` subspec (Apple MapKit only), `HAVE_GOOGLE_MAPS` is defined as
`0`, and `provider={PROVIDER_GOOGLE}` **silently falls back to Apple Maps** — an
unstyled but otherwise working map, which is why this failure is so easy to miss.

### 5.2 `ios/Podfile` — the key injection hook

The `post_install` hook reads `.env`, writes `ios/Config/Env.generated.xcconfig`
(gitignored), and appends an `#include?` of it to the CocoaPods-generated
xcconfigs. Full rationale in
[CONFIGURATION.md](./CONFIGURATION.md#7-iospodfile).

### 5.3 Install the pods

```sh
cd ios
pod install
```

**Expected output** — you should see all of these lines:

```
Installing GoogleMaps (9.4.0)
Installing Google-Maps-iOS-Utils (6.1.0)
Installing react-native-maps (1.29.0)
Pod installation complete!
```

If `GoogleMaps` does **not** appear, the subspec line in the Podfile is missing
or mis-ordered — iOS will build and run with Apple Maps.

**Verification — confirm the key reached the xcconfig:**

```sh
cat ios/Config/Env.generated.xcconfig
# MAPS_API_KEY = AIzaSy...

grep -l "Env.generated.xcconfig" ios/Pods/Target\ Support\ Files/Pods-iiGrain/*.xcconfig
# should list the debug and release xcconfigs
```

If `Env.generated.xcconfig` is missing or the value is empty, CocoaPods also
printed `[!] MAPS_API_KEY is not set` during `pod install`.

### 5.4 `ios/iiGrain/Info.plist`

```xml
<key>GMSApiKey</key>
<string>$(MAPS_API_KEY)</string>
```

`$(MAPS_API_KEY)` is a **build setting**, expanded by Xcode at build time from
the xcconfig above.

Location usage strings were already present and needed no change:
`NSLocationWhenInUseUsageDescription`,
`NSLocationAlwaysAndWhenInUseUsageDescription`.

### 5.5 `ios/iiGrain/AppDelegate.swift`

```swift
import GoogleMaps
…
configureGoogleMaps()   // FIRST statement of didFinishLaunchingWithOptions
```

It reads `GMSApiKey` from the bundle and calls `GMSServices.provideAPIKey`.
Why it must be first is explained in [FLOW.md](./FLOW.md#stage-2-native-sdk-authorisation).

### 5.6 Build and verify

```sh
npx react-native run-ios
```

**Verification — check the built app's Info.plist, not the source one:**

```sh
/usr/libexec/PlistBuddy -c "Print :GMSApiKey" \
  ~/Library/Developer/Xcode/DerivedData/iiGrain-*/Build/Products/Debug-iphonesimulator/iiGrain.app/Info.plist
```

**Expected:** your key. If it prints `$(MAPS_API_KEY)` literally, the xcconfig
include did not take — re-run `pod install` and clean the build folder
(`Product → Clean Build Folder`, ⇧⌘K).

If the key is missing, the app still launches and Xcode's console shows:

```
[Maps] GMSApiKey is empty — maps will render blank. Set MAPS_API_KEY in application/.env and re-run `pod install`.
```

---

## 6. End-to-end verification checklist

Run through these in the app. Each one exercises a different part of the stack.

| # | Action | Expected | Proves |
|---|---|---|---|
| 1 | Farms → Add Farm → tap the location field | Full-screen map, tiles visible, muted styling (no shop icons) | Key + tiles + `customMapStyle` |
| 2 | Pan the map | Pin lifts off its shadow while moving, settles on release | `MapCenterPin`, region events |
| 3 | Stop panning | Footer shows an address within ~1 s | Nominatim reverse geocode |
| 4 | Tap the GPS button | Map flies to your position at building zoom | Permissions + `useMapCamera` |
| 5 | Search "Nagpur" | Suggestions list; tapping one moves the map | Nominatim search |
| 6 | Confirm | Returns coordinates to the form, 6 decimal places | `COORDINATE_PRECISION` |
| 7 | Field Details → Overview | Small map with a green marker, no road labels | `styleVariant="preview"` |
| 8 | Scroll that page with a finger starting on the map | The page scrolls, the map does not steal the gesture | Touch-forwarding wiring |
| 9 | Open a live visit (assessor en route) | Two markers, a solid green road line, "X km · Y min away" | Directions API + `useRouteToDestination` |
| 10 | Turn on airplane mode during #9 | Line becomes a dashed straight line; no crash | Fallback path |

**Both platforms must be checked.** The whole point of pinning iOS to Google is
that #1 and #7 look identical; if iOS looks like stock Apple Maps, revisit §5.1.

---

## 7. Command reference

```sh
# Full clean rebuild — Android
cd android && ./gradlew clean && cd .. && npx react-native run-android

# Full clean rebuild — iOS
cd ios && rm -rf Pods Podfile.lock build && pod install && cd ..
npx react-native run-ios

# Re-inject the key after editing .env
#   Android: any gradle build re-reads .env automatically
#   iOS:     you MUST re-run `pod install` — the xcconfig is generated there
cd ios && pod install && cd ..

# Metro cache reset (needed after changing .env, because @env is inlined
# into the bundle at BABEL time and the old value is cached)
npx react-native start --reset-cache
```

> **The `.env` → JS gotcha.** `react-native-dotenv` inlines `.env` values at
> **build** time, into the transformer cache. Editing `.env` and reloading is not
> enough — restart Metro with `--reset-cache` or the old value persists.
