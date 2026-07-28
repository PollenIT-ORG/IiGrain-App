# CONFIGURATION — every file, why it exists, what breaks without it

One section per configuration file touched by the Google Maps integration. Each
answers the same five questions:

- **Why it exists**
- **Who reads it** (which tool, at which moment)
- **When it is executed**
- **What happens if it is removed or wrong**
- **How to verify it**

The single fact that makes this whole chain necessary:

> **The native Google Maps SDKs are initialised before JavaScript exists.**
> On Android the SDK reads its key from the merged AndroidManifest as the process
> starts. On iOS it must be keyed before the first `GMSMapView` is created. Neither
> can be handed a value from the JS bundle. So the key must travel through the
> **build system**, not through the app.

---

## 0. The key's three journeys

`.env` holds **one** variable, `MAPS_API_KEY`, consumed by **three** independent
toolchains that share nothing with each other:

```
                       application/.env
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
   [Gradle]              [CocoaPods]             [Babel]
   configuration        `pod install`         bundle transform
        │                     │                     │
manifestPlaceholders   Env.generated.xcconfig   `@env` module
        │                     │                     │
 AndroidManifest.xml    $(MAPS_API_KEY)      src/config/env.ts
 geo.API_KEY               ↓                       │
        │            Info.plist GMSApiKey     Env.MAPS_API_KEY
        │                     │                     │
        ▼                     ▼                     ▼
 Maps SDK Android    AppDelegate.swift →     Directions API
   (native tiles)    GMSServices            (JS fetch, routing)
                     (native tiles)
```

Three paths, because Gradle cannot read Babel's output, CocoaPods cannot read
Gradle's, and JavaScript cannot reach either native manifest. There is no
shortcut that removes one of them.

---

## 1. `.env`

**Path:** `application/.env` · **Gitignored:** yes · **Committed:** never

### Why it exists
It is the single source of truth for per-environment secrets and endpoints. It
keeps the API key out of source control, and lets dev / staging / production use
different keys without a code change.

### Who reads it
Three readers, at three different times:

| Reader | Mechanism | When |
|---|---|---|
| Babel (`react-native-dotenv`) | `babel.config.js` plugin → the `@env` module | Every JS bundle transform |
| Gradle | `resolveMapsApiKey()` in `android/app/build.gradle`, via `java.util.Properties` | Gradle **configuration** phase, every Android build |
| CocoaPods | `resolve_maps_api_key` in `ios/Podfile` | Only during `pod install` |

### What belongs here
```dotenv
API_BASE_URL=https://api.farmer.tcqitsolution.com
API_PREFIX=/api/v1
API_TIMEOUT=15000
MAPS_API_KEY=AIzaSy...
```

Anything environment-specific or secret. **Not** feature flags that should be
code-reviewed, and **not** anything the backend owns.

### If it is missing or `MAPS_API_KEY` is empty
Nothing crashes — this is deliberate, so a developer without Maps Platform access
can still work on the rest of the app:

- Gradle logs `⚠️ MAPS_API_KEY is not set` and injects `""`.
- CocoaPods logs `[!] MAPS_API_KEY is not set` and writes an empty xcconfig value.
- `AppDelegate` logs `[Maps] GMSApiKey is empty` and skips `provideAPIKey`.
- `fetchDrivingRoute` returns `null`, and `VisitMap` shows the dashed fallback.
- **Every map renders as a blank grey grid.**

### ⚠️ The cache gotcha
`react-native-dotenv` inlines values at **transform** time and Metro caches the
result. Editing `.env` and hot-reloading does not pick up the new value.
Restart with `npx react-native start --reset-cache`. On iOS you must also re-run
`pod install`, because the xcconfig is only generated there.

### Verify
```sh
grep MAPS_API_KEY .env        # non-empty
git check-ignore -v .env      # confirms it is ignored
```

---

## 2. `.env.example`

**Path:** `application/.env.example` · **Committed:** yes

### Why it exists
It is the schema of `.env`. A new developer cannot know which variables exist by
reading code — `@env` imports are scattered. This file is the contract, and it
documents which Google Cloud APIs each key needs enabled.

### If it is removed
Onboarding breaks silently: a new clone builds fine and every map is blank, with
no signal that a variable was ever expected.

### Rule
`MAPS_API_KEY=` must stay **empty** here. A real key in `.env.example` is a
committed secret.

---

## 3. `babel.config.js`

**Path:** `application/babel.config.js` · **Unchanged by this integration**

### Why it matters here
It configures `module:react-native-dotenv`, which is what makes
`import { MAPS_API_KEY } from '@env'` resolve at all.

```js
['module:react-native-dotenv', {
  moduleName: '@env',
  path: '.env',
  safe: false,
  allowUndefined: true,
}]
```

### When it runs
At every JS transform — Metro in development, the bundler in release.

### What it does *not* do
It has no reach into Gradle or CocoaPods. This is precisely why sections 5 and 7
exist. A common wrong assumption is "the key is in `.env`, so the native side has
it" — it does not.

### If removed
`@env` fails to resolve, `src/config/env.ts` fails to compile, and the whole app
fails to bundle — not just maps.

---

## 4. `src/types/env.d.ts`

**Path:** `application/src/types/env.d.ts` · **Committed:** yes

### Why TypeScript requires it
`@env` is a **virtual module** synthesised by a Babel plugin. It has no file on
disk, so TypeScript has nothing to resolve and would report
`Cannot find module '@env'`. This ambient declaration tells the compiler the
module exists and what it exports.

```ts
declare module '@env' {
  export const MAPS_API_KEY: string;
  …
}
```

### How autocomplete works
Because the module is declared, the language server offers the exported names on
`import { … } from '@env'` and type-checks their use as `string`.

### The trap
This file is a **promise, not a guarantee**. It declares `MAPS_API_KEY: string`,
but at runtime the plugin injects `undefined` when the variable is absent from
`.env` (`allowUndefined: true`). That is why `src/config/env.ts` writes
`(MAPS_API_KEY ?? '').trim()` rather than trusting the type.

### If removed
Compilation fails project-wide.

---

## 5. `src/config/env.ts`

**Path:** `application/src/config/env.ts` · **Modified by this integration**

### Why it exists
It is the app's only sanctioned reader of `@env`. Everything else imports the
frozen `Env` object. That centralises defaulting, trimming, parsing and the
remote-host fallback, so no screen ever deals with a possibly-undefined string.

### Change made here
`MAPS_API_KEY` was being assigned into `Env` without being declared on the
`AppEnv` interface — so `Env.MAPS_API_KEY` was not visible to TypeScript and any
consumer would have failed to compile. The field is now declared, documented, and
normalised:

```ts
export interface AppEnv {
  …
  /** Used from JS ONLY for the Directions API. Native tiles are keyed at
   *  build time — see docs/maps/CONFIGURATION.md. */
  readonly MAPS_API_KEY: string;
}

export const Env: AppEnv = Object.freeze({
  …
  MAPS_API_KEY: (MAPS_API_KEY ?? '').trim(),
});
```

### Who reads `Env.MAPS_API_KEY`
Exactly one file: `src/maps/services/directionsService.ts`. **The map tiles never
read it** — they are keyed natively. If you find another JS consumer, question it.

### If removed
`directionsService` cannot authenticate; routes silently degrade to the dashed
straight-line fallback. Tiles are unaffected.

---

## 6. `android/app/build.gradle`

**Modified by this integration.**

### Why the change exists
To bridge `.env` → the AndroidManifest. Gradle is the only process that runs
between "developer has a `.env`" and "manifest is merged", so it is the only
place this substitution can happen.

### What was added

```gradle
def resolveMapsApiKey() {
    def fromProcessEnv = System.getenv("MAPS_API_KEY")      // 1. CI
    if (fromProcessEnv?.trim()) return fromProcessEnv.trim()

    def envFile = rootProject.file("../.env")               // 2. local dev
    if (envFile.exists()) {
        def props = new Properties()
        envFile.withInputStream { props.load(it) }
        …
    }
    return ""                                               // 3. warn, continue
}

android {
  defaultConfig {
    manifestPlaceholders["MAPS_API_KEY"] = mapsApiKey
  }
}
```

### Why the precedence is env-var first
CI and Play Console builds must inject the key from a secret store without ever
writing a `.env` to disk. The environment variable wins so a stale local `.env`
can never override a release key.

### Why `manifestPlaceholders["X"] = …` and not `manifestPlaceholders = [X: …]`
The React Native Gradle plugin puts `usesCleartextTraffic` into the same map (see
the `<application>` tag in the manifest). Assigning a whole new map would drop it
and break the manifest merge. Single-key assignment adds without replacing.

### Why `java.util.Properties` and not a hand-rolled parser
It handles `KEY=value` and `#` comments — exactly the dotenv subset this project
uses — with no dependency and no regex to get wrong.

### Why it warns instead of failing
A missing key must not block unit tests, lint builds, or a developer working on
non-map screens. The build succeeds; the maps are blank; the warning says so.

### Build lifecycle — when this runs

```
gradle build
  │
  ├─ INITIALISATION   settings.gradle, which projects exist
  │
  ├─ CONFIGURATION    ← resolveMapsApiKey() runs HERE, once per build
  │                     manifestPlaceholders is populated
  │
  └─ EXECUTION        tasks run in dependency order
       ├─ :app:processDebugManifest   ← ${MAPS_API_KEY} is substituted HERE
       ├─ :app:compile…
       ├─ :app:mergeResources
       └─ :app:packageDebug           → APK contains the literal key
```

Because resolution happens at configuration time, **editing `.env` invalidates
the configuration cache and the next build picks it up automatically.** No clean
is needed on Android (unlike iOS).

### If removed
`${MAPS_API_KEY}` in the manifest resolves to nothing and the manifest merger
fails hard with:
`Attribute meta-data#com.google.android.geo.API_KEY@value requires a placeholder substitution but no value for <MAPS_API_KEY> is provided.`

### Verify
See [SETUP.md §4.5](./SETUP.md#45-build-and-verify).

---

## 7. `android/app/src/main/AndroidManifest.xml`

**Modified by this integration.**

### Why Google Maps requires the key here
The Maps Android SDK looks up `com.google.android.geo.API_KEY` from the
application's `PackageManager` metadata during `MapView` initialisation. That is
a native lookup on the **merged manifest inside the installed APK**; there is no
API to supply the key at runtime.

### What was fixed
The `meta-data` element already existed, but was **commented out** *and* placed
**outside** `<application>`. Both had to change:

- Uncommented — otherwise there is no key at all.
- Moved inside `<application>` — the manifest merger ignores `meta-data` that is
  a direct child of `<manifest>`, so even uncommented it would have done nothing
  while looking correct in a diff.

### How placeholder replacement works
`${MAPS_API_KEY}` is **not** a Gradle variable, a shell variable, or a JS
variable. It is an *AGP manifest placeholder*, a distinct mechanism resolved by
the `process<Variant>Manifest` task from `defaultConfig.manifestPlaceholders`.
The substitution happens while producing
`app/build/intermediates/merged_manifests/<variant>/AndroidManifest.xml`.

### The second `meta-data`
```xml
<meta-data android:name="com.google.android.gms.version"
           android:value="@integer/google_play_services_version" />
```
`@integer/google_play_services_version` is a resource contributed by the Play
Services AAR. The SDK compares it against the version installed on the device and
triggers the "update Google Play services" dialog when the device is behind.
Hardcoding a number here breaks that check.

### Permissions (already present, unchanged)
`INTERNET` — tile downloads. `ACCESS_FINE_LOCATION` / `ACCESS_COARSE_LOCATION` —
"use my location" and `showsUserLocation`.

### If removed
Blank grey grid, and logcat shows:
```
Authorization failure. Ensure that the "Maps SDK for Android" is enabled.
API Key: (empty)
```

---

## 8. `android/build.gradle`

**Modified by this integration.**

### Why the change exists
`react-native-maps/android/build.gradle` resolves its Play Services versions
through `safeExtGet('googlePlayServicesMapsVersion', '19.1.0')` — i.e. it reads
`rootProject.ext` if we set it, and falls back to its own default otherwise.

Leaving them implicit means a `npm update react-native-maps` can silently change
which Maps SDK ships in our APK. Pinning them makes the map stack an explicit,
reviewable part of *this* project's dependency graph:

```gradle
googlePlayServicesMapsVersion = "19.1.0"
googlePlayServicesBaseVersion = "18.5.0"
googlePlayServicesLocationVersion = "21.3.0"
```

### If removed
Nothing breaks today — the library's defaults are identical. The protection is
against future drift.

---

## 9. `ios/Podfile`

**Modified by this integration.** Two separate changes.

### 9.1 The Google subspec

```ruby
pod 'react-native-maps/Google', :path => '../node_modules/react-native-maps'
```

**Why:** `react-native-maps.podspec` declares `s.default_subspec = 'Maps'`, which
compiles Apple MapKit support only. A build script in that subspec then checks
whether `$PODS_ROOT/GoogleMaps` exists and writes
`#define HAVE_GOOGLE_MAPS 0` when it does not. With that flag at 0,
`provider={PROVIDER_GOOGLE}` **silently renders Apple Maps**.

Declaring the `/Google` subspec pulls in `GoogleMaps` (9.4.0) and
`Google-Maps-iOS-Utils` (6.1.0) and flips the flag to 1.

**Why before `use_react_native!`:** CocoaPods must see the subspec requirement
before autolinking resolves `react-native-maps` with its default subspec.

**If removed:** iOS builds and runs, showing an unstyled Apple map. No error
anywhere. This is the single most deceptive failure in the whole integration.

### 9.2 The key-injection `post_install` hook

**Why it exists:** `AppDelegate.swift` cannot read `.env`. The key has to become
an Xcode **build setting**, and there are only three ways to do that:

| Approach | Why not |
|---|---|
| Hardcode in `AppDelegate.swift` | Secret committed to git and shipped in a readable binary. |
| Write into `project.pbxproj` build settings | `project.pbxproj` **is** committed — same leak, plus a permanently dirty diff. |
| **Generate a gitignored xcconfig and include it** | ✅ chosen |

**How it works:**

1. `resolve_maps_api_key` reads `$MAPS_API_KEY`, else `application/.env`.
2. `write_maps_xcconfig` writes `ios/Config/Env.generated.xcconfig`, containing
   `MAPS_API_KEY = <value>`. This path is in `.gitignore`.
3. The hook appends `#include? "…/Env.generated.xcconfig"` to each
   CocoaPods-generated `Pods-iiGrain.*.xcconfig`. Those files are the app target's
   base configuration, and `ios/Pods/` is already gitignored.
4. Appended **last**, so our assignment wins over anything defined above it.
5. `#include?` (with the question mark) is the *optional* include — a missing file
   is not a build error, so a clone that has not run `pod install` still builds.

**When it runs:** only during `pod install`. **This is the iOS gotcha: editing
`.env` requires re-running `pod install`.** Android re-reads on every build; iOS
does not.

**If removed:** `$(MAPS_API_KEY)` never resolves, `GMSApiKey` expands to the
literal string `$(MAPS_API_KEY)`, `provideAPIKey` is called with garbage, and the
SDK logs an authorisation failure.

---

## 10. `ios/iiGrain/Info.plist`

**Modified by this integration.**

### Why iOS needs the key here
It does **not**, strictly — unlike Android, the Google Maps iOS SDK has no
Info.plist convention and never reads this entry. `GMSApiKey` exists purely as
the **transport** that carries a build-time value into Swift, which has no other
way to see build settings.

The mechanism that makes it work: Xcode expands `$(VARIABLE)` inside Info.plist
*values* from the target's build settings during the `Process Info.plist` build
phase. So:

```
Env.generated.xcconfig  →  build setting MAPS_API_KEY
                        →  Info.plist `$(MAPS_API_KEY)` expands
                        →  Bundle.main.object(forInfoDictionaryKey: "GMSApiKey")
```

### Why not hardcode it
`Info.plist` is committed. A literal key here is a committed secret *and* is
trivially readable by anyone who unzips the `.ipa`.

### Related entries (already present)
`NSLocationWhenInUseUsageDescription` and
`NSLocationAlwaysAndWhenInUseUsageDescription` — iOS **terminates the app** if
location is requested without them. `showsUserLocation` and the picker's GPS
button both trigger that request.

### If removed
`AppDelegate` finds no `GMSApiKey`, logs the warning, and skips authorisation.
Every iOS map is blank.

---

## 11. `ios/iiGrain/AppDelegate.swift`

**Modified by this integration.**

### Why Google Maps initialises here
`GMSServices.provideAPIKey(_:)` authorises a **process-wide singleton**, and it
has no retry: if the first `GMSMapView` is constructed before the key is set, the
SDK logs

```
Google Maps SDK for iOS must be initialized via [GMSServices provideAPIKey:...]
```

and **every map for the rest of the process stays blank** — even after a later
`provideAPIKey` call. There is no recovery short of relaunching.

React Native mounts `<AppMapView>` some milliseconds after
`factory.startReactNative(...)`. `didFinishLaunchingWithOptions` is the last
guaranteed point before any JS runs, so the call goes there, as its **first
statement**.

### Why it reads the key instead of holding it
See §10. The file is committed; the key must not be.

### Why it warns instead of crashing
`guard !apiKey.isEmpty else { NSLog(…); return }`. A developer without Maps
Platform access must still be able to run the app. A `fatalError` here would make
a missing optional secret a hard launch blocker.

### If removed
Every iOS map is blank, with the SDK's initialisation error in the Xcode console.

---

## 12. `.gitignore`

**Modified by this integration.**

```gitignore
ios/Config/Env.generated.xcconfig
```

Added because the generated xcconfig **contains the API key in plain text**.
`.env` was already ignored; `ios/Pods/` (which holds the xcconfigs we append to)
already was too. This line closes the third path.

**If removed:** the next `git add -A` after a `pod install` commits the key. See
[SECURITY.md §6](./SECURITY.md#6-key-rotation) for what to do if that has already
happened — the answer is *rotate*, not *delete the commit*.

---

## 13. `src/maps/config/*` — application-level configuration

Not build configuration, but the same "one place to change it" principle.

| File | Holds | Change it when |
|---|---|---|
| `mapDefaults.ts` | Zoom tokens, default centre, animation durations, jitter epsilon, fit padding, coordinate precision | Tuning how maps behave |
| `mapStyle.ts` | The branded Google JSON style arrays | Tuning how maps look |

`mapStyle.ts` arrays are generated at <https://mapstyle.withgoogle.com/> — do not
hand-write them. They are ignored when `mapKind` is `satellite` or `hybrid`;
that is Google SDK behaviour, not a bug.
