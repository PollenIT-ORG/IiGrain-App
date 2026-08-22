# 07 — Migration Checklist

> Ordered exactly as it should be performed. Each phase depends on the one before it.
>
> **Read `04_PLAY_STORE_READY.md` §2 before starting Phase 0.** The Android upload keystore does not
> exist in this repository, and that is a blocker that cannot be solved by any amount of file
> copying.

**Legend** — 🔴 unrecoverable if wrong · 🟠 visible regression · 🟢 low risk

---

## Phase 0 — Pre-flight: gather what the repository cannot tell you

**Do not create the new project until this phase is complete.** Every item here is external
information; discovering a gap later can invalidate work already done.

- [ ] 🔴 **Confirm whether the app is live on Google Play.** `versionCode` is still `1`, which
      suggests it may never have shipped. If it has not, the whole signing constraint disappears.
- [ ] 🔴 **Locate the Android upload keystore.** Candidate in the tree:
      `application/your_key_name.keystore` (untracked, referenced by no Gradle file). Confirm
      whether it is the real one or whether the true keystore lives only on a publisher's machine or
      in CI secrets.
- [ ] 🔴 **Obtain keystore credentials** — store password, key alias, key password. These exist
      nowhere in the repository.
- [ ] 🔴 **Check Play App Signing status** (Play Console → Setup → App integrity).
      Enabled → you only need the upload key, resettable with Google's help.
      Disabled → the upload key **is** the app-signing key; losing it permanently ends updates.
- [ ] 🔴 **Record the highest accepted `versionCode`** from Play Console. The next upload must exceed it.
- [ ] 🔴 **Record both certificate SHA-1 and SHA-256 fingerprints** (upload cert **and** app-signing
      cert) from Play Console → App integrity.
- [ ] 🔴 **Verify Maps API key restrictions** in Google Cloud Console: which package names, which
      SHA-1 fingerprints, and whether Android and iOS share one key. Confirm the fingerprint your
      migrated release will carry is on the allow-list — otherwise **maps go blank in production
      while the build succeeds silently**.
- [ ] 🔴 **Confirm Apple Developer access** to team `SADMK33W84` with at least App Manager/Developer role.
- [ ] 🔴 **Record the highest TestFlight build number** for `com.amitbaser.iigrain` (repo says `9`).
- [ ] 🟠 **Back up the current working tree** — tag the git commit you are migrating from.
- [ ] 🟠 **Back up the keystore** to secure storage.
- [ ] 🟠 **Capture reference screenshots** from the current build: launcher icon, native splash,
      launch screen, a rendered map, status-bar colour. These are your visual regression baseline.
- [ ] 🟢 **Install the current TestFlight build on a device and sign in** — you will install the
      migrated build over it in Phase 11 to prove keychain continuity.
- [ ] 🟢 **Note the build machine constraint:** this repo lives on Windows. iOS work (Phases 6–8,
      most of 10–11) requires macOS with Xcode.

---

## Phase 1 — Create the fresh React Native project

- [ ] 🔴 **Initialise at React Native `0.84.1`** — not "latest". `package.json` pins
      `react-native: ^0.84.1` and `Podfile.lock` confirms `0.84.1`. A different version ships
      different native templates and invalidates every setting documented here.
      ```
      npx @react-native-community/cli@20.1.3 init iiGrain --version 0.84.1
      ```
- [ ] 🔴 Project name **`iiGrain`** (drives `rootProject.name`, the Xcode target/scheme/product,
      and the JS module name).
- [ ] 🟢 Verify the scaffold builds and runs on both platforms **before** changing anything. This is
      your known-good baseline — do not skip it.
- [ ] 🟢 Note the JS tooling inconsistency: `@react-native/*` dev deps are pinned to `0.86.0` while
      runtime RN is `0.84.1`. Reproduce as-is; do not resolve it during the migration.

---

## Phase 2 — Install dependencies

- [ ] 🔴 Copy `package.json` `dependencies` and `devDependencies` verbatim (39 + 20 entries), then
      `npm install`. Pod and Gradle versions follow from these — installing different versions
      changes the native surface.
- [ ] 🟢 Copy `react-native.config.js` — `assets: ['./src/assets/fonts']` drives font linking.
- [ ] 🟢 Copy `app.json` — `{ "name": "iiGrain", "displayName": "iiGrain" }`.
- [ ] 🟢 Copy `.gitignore`, **especially** the keystore rules (`*.keystore` with `!debug.keystore`,
      `*.jks`, `android/keystores/`, `*.keystore.properties`) and
      `ios/Config/Env.generated.xcconfig`.
- [ ] 🟢 `patches/` is **empty** — nothing to carry over despite the `postinstall: patch-package` script.
- [ ] 🟢 Verify autolinking produced the same **24 Android packages** listed in
      `02_ANDROID_CONFIGURATION.md` §14.

---

## Phase 3 — Environment and secrets

- [ ] 🔴 Create `application/.env` with `API_BASE_URL`, `API_PREFIX`, `API_TIMEOUT`, `MAPS_API_KEY`
      (see `.env.example`). `.env` is gitignored — copy it out-of-band, never via git.
- [ ] 🔴 **`MAPS_API_KEY` must be the unchanged value.** A different key changes billing, quota and
      restriction scope.
- [ ] 🟢 Confirm `.env` and `.env.*` (except `.env.example`) are gitignored.
- [ ] 🟢 Copy `.env.example`.

---

## Phase 4 — Android identity

- [ ] 🔴 Set `applicationId "com.iigrain"` in `android/app/build.gradle`.
- [ ] 🔴 Set `namespace "com.iigrain"`.
- [ ] 🔴 Move Kotlin sources to `android/app/src/main/java/com/iigrain/` with `package com.iigrain`.
- [ ] 🔴 Set `app_name` = `iiGrain` in `res/values/strings.xml`.
- [ ] 🔴 Set `versionCode` to the value from Phase 0 (**not** `1`), `versionName "1.0"`.
- [ ] 🟢 Set `rootProject.name = 'iiGrain'` in `android/settings.gradle`.

**Verify:** `aapt2 dump badging` prints `package: name='com.iigrain'`.

---

## Phase 5 — Android build configuration

### 5.1 SDK levels and toolchain (`android/build.gradle` → `buildscript.ext`)
- [ ] 🔴 `minSdkVersion = 24`, `compileSdkVersion = 36`, `targetSdkVersion = 36`
- [ ] 🔴 `buildToolsVersion = "36.0.0"`, `ndkVersion = "27.1.12297006"`, `kotlinVersion = "2.1.20"`
- [ ] 🔴 The three Play Services pins:
      `googlePlayServicesMapsVersion = "19.1.0"`,
      `googlePlayServicesBaseVersion = "18.5.0"`,
      `googlePlayServicesLocationVersion = "21.3.0"`
      *(omitting these silently un-pins the Maps SDK)*
- [ ] 🟠 `gradle-wrapper.properties` → Gradle `9.3.1`

### 5.2 `gradle.properties`
- [ ] 🔴 `newArchEnabled=true` *(false is unsupported on RN 0.82+)*
- [ ] 🔴 `hermesEnabled=true`
- [ ] 🟠 `edgeToEdgeEnabled=false`
- [ ] 🟠 `reactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64`
- [ ] 🟠 `android.useAndroidX=true`, `org.gradle.jvmargs=-Xmx2048m -XX:MaxMetaspaceSize=512m`
- [ ] 🟡 **Do not** copy the `MAPS_API_KEY` line — nothing reads it, and it duplicates a secret into
      version control

### 5.3 Maps key plumbing (`android/app/build.gradle`)
- [ ] 🔴 Copy the `resolveMapsApiKey()` function (env var → `.env` → `""` with a loud warning)
- [ ] 🔴 Copy `manifestPlaceholders["MAPS_API_KEY"] = mapsApiKey`, using the **single-key subscript
      form** so the RN plugin's `usesCleartextTraffic` entry survives the merge

### 5.4 Dependencies and plugins
- [ ] 🔴 `implementation("androidx.core:core-splashscreen:1.0.1")`
- [ ] 🔴 `project.ext.vectoricons = [ iconFontNames: ['MaterialCommunityIcons.ttf'] ]` +
      `apply from: file("../../node_modules/react-native-vector-icons/fonts.gradle")`
      *(only this one font is bundled — omit and every icon disappears)*
- [ ] 🟢 `jscFlavor = 'io.github.react-native-community:jsc-android:2026004.+'` (unused while Hermes is on)
- [ ] 🟢 Leave the `react-native-config` dotenv line commented out, as it is today

### 5.5 Signing and build types
- [ ] 🔴 **Create a real `release` signing config** reading credentials from outside VCS.
      **Do not** reproduce `release { signingConfig signingConfigs.debug }` — that is the one place
      the migration should deliberately not copy current state.
- [ ] 🟢 Keep the `debug` signing config (`debug.keystore`, `androiddebugkey`)
- [ ] 🟢 Copy `debug.keystore` if you want a stable debug SHA-1 for the Maps allow-list
- [ ] 🟢 `enableProguardInReleaseBuilds = false` (matches current — no minification)
- [ ] 🟢 No product flavors

---

## Phase 6 — `AndroidManifest.xml`

- [ ] 🔴 All **8** permissions — `INTERNET`, `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`,
      `CAMERA`, `RECORD_AUDIO`, `READ_MEDIA_IMAGES`, `READ_MEDIA_VIDEO`, and
      `READ_EXTERNAL_STORAGE` **with `android:maxSdkVersion="32"`**
- [ ] 🟠 `<uses-feature android:name="android.hardware.camera" android:required="false" />`
      *(`true` removes the app from Play for camera-less devices)*
- [ ] 🔴 `<application>`: `android:name=".MainApplication"`, `android:label="@string/app_name"`,
      `android:icon="@mipmap/ic_launcher"`, `android:roundIcon="@mipmap/ic_launcher_round"`,
      `android:allowBackup="false"`, `android:theme="@style/AppTheme"`,
      `android:usesCleartextTraffic="${usesCleartextTraffic}"`, `android:supportsRtl="true"`
- [ ] 🔴 `com.google.android.geo.API_KEY` meta-data **inside `<application>`**
      *(outside it the merger drops it and every map is a grey grid)*
- [ ] 🔴 `com.google.android.gms.version` = `@integer/google_play_services_version`
      *(never a hardcoded number)*
- [ ] 🔴 `MainActivity`: `android:launchMode="singleTask"`, `android:screenOrientation="portrait"`,
      `android:windowSoftInputMode="adjustResize"`, `android:theme="@style/Theme.App.SplashScreen"`,
      `android:exported="true"`, and the full `configChanges` list
- [ ] 🔴 Exactly **one** intent filter: `MAIN` + `LAUNCHER`
- [ ] 🟢 Add **no** deep links, **no** URL schemes, **no** extra intent filters
- [ ] 🟡 Prefer restoring the `${MAPS_API_KEY}` placeholder form over the current hardcoded literal —
      but only **after** verifying maps work with the literal (change one thing at a time)

---

## Phase 7 — Android native code

> These two files carry the project's real Android customisations. Every item has a
> hard-to-diagnose failure mode.

### 7.1 `MainApplication.kt`
- [ ] 🔴 Copy the **`Ipv4PreferredDns` object** and **`Ipv4OkHttpClientFactory` class** verbatim
- [ ] 🔴 Call `OkHttpClientProvider.setOkHttpClientFactory(Ipv4OkHttpClientFactory())` in `onCreate()`
      **before** `loadReactNative(this)`
      *(the API host is dual-stack; without this, networks/emulators that advertise but cannot route
      IPv6 stall and surface bogus "Network Error" to JS)*
- [ ] 🟢 Standard `reactHost` via `getDefaultReactHost(applicationContext, PackageList(this).packages)`

### 7.2 `MainActivity.kt`
- [ ] 🔴 `installSplashScreen()` as the **first** statement of `onCreate`
- [ ] 🔴 `WindowCompat.setDecorFitsSystemWindows(window, false)`
      *(makes window insets reach `react-native-safe-area-context`; without it the green status-bar
      strip collapses to 0 height and is invisible)*
- [ ] 🔴 `super.onCreate(null)` — **not** `super.onCreate(savedInstanceState)`
      *(`react-native-screens` requirement; avoids a fragment state-restoration crash)*
- [ ] 🔴 `getMainComponentName()` returns `"iiGrain"`
- [ ] 🟢 `DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)`

---

## Phase 8 — Android resources

### 8.1 Themes and colours
- [ ] 🔴 `AppTheme` (parent `Theme.AppCompat.Light.NoActionBar`) with
      `android:editTextBackground=@drawable/rn_edit_text_material`,
      `android:windowBackground=@android:color/white`,
      `android:forceDarkAllowed=false`,
      `android:statusBarColor=#167A45`,
      `android:windowLightStatusBar=false`
- [ ] 🔴 `Theme.App.SplashScreen` (parent `Theme.SplashScreen`) with
      `windowSplashScreenBackground=@color/splash_background`,
      `windowSplashScreenAnimatedIcon=@drawable/splash_icon`,
      `postSplashScreenTheme=@style/AppTheme`
- [ ] 🔴 `colors.xml`: `ic_launcher_background` = `#FFFFFF`, `splash_background` = `#FFFFFF`

### 8.2 Icons (detail in `06_APP_ICONS.md`)
- [ ] 🔴 All **15** `mipmap-*/ic_launcher*.png` (48–192 / 48–192 / 108–432 px)
- [ ] 🔴 Both `mipmap-anydpi-v26/ic_launcher.xml` and `ic_launcher_round.xml`
- [ ] 🟠 All **5** `drawable-*/splash_icon.png` (288 / 432 / 576 / 864 / 1152 px)
- [ ] 🟢 Add **no** `<monochrome>` layer and **no** notification icon (preserves current behaviour)

### 8.3 Fonts
- [ ] 🟠 Ensure `src/assets/fonts/Inter-{Regular,Medium,SemiBold,Bold}.ttf` exist, then run
      `npx react-native-asset` — do not hand-copy into `android/app/src/main/assets/fonts/`
- [ ] 🟢 `link-assets-manifest.json` is regenerated by that command

### 8.4 Do NOT copy
- [ ] 🔴 **`android/app/src/main/assets/index.android.bundle`** — a stale committed JS bundle that
      would shadow the freshly built one and ship old JavaScript
- [ ] 🟢 `res/raw/keep.xml` — bundler-generated
- [ ] 🟢 `res/drawable-*/src_assets_*` and `res/drawable-*/node_modules_*` PNGs — bundler-generated
- [ ] 🟢 `android/local.properties` — machine-specific
- [ ] 🟢 `android/app/proguard-rules.pro` — comments only, nothing to carry

**Verify Android before moving on:** debug build installs, launches, splash → app with no colour
flash, correct icon, green status bar, portrait lock, maps render, fonts and MaterialCommunityIcons
render.

---

## Phase 9 — iOS identity and project settings

*(macOS + Xcode required from here.)*

- [ ] 🔴 `PRODUCT_BUNDLE_IDENTIFIER = com.amitbaser.iigrain` in **both** Debug and Release
- [ ] 🔴 `DEVELOPMENT_TEAM = SADMK33W84` in **both** configs
- [ ] 🔴 `CODE_SIGN_STYLE = Automatic` in both configs
- [ ] 🔴 **Create no `.entitlements` file**; leave `CODE_SIGN_ENTITLEMENTS` unset
- [ ] 🔴 **Enable no capabilities** in Signing & Capabilities — one click creates an entitlements
      file, changes the provisioning profile, and can fail App Store validation
- [ ] 🔴 `MARKETING_VERSION = 2.0`; `CURRENT_PROJECT_VERSION` = the Phase 0 value (**≥ 10**)
- [ ] 🔴 `IPHONEOS_DEPLOYMENT_TARGET = 15.1` at **project and target** level
- [ ] 🔴 `ENABLE_USER_SCRIPT_SANDBOXING = NO` *(else the archive fails — the RN bundle phase writes
      outside the sandbox)*
- [ ] 🔴 `OTHER_LDFLAGS = $(inherited), -ObjC, -lc++`
- [ ] 🔴 `ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon`
- [ ] 🟠 `SWIFT_VERSION = 5.0`, `PRODUCT_NAME = iiGrain`, `TARGETED_DEVICE_FAMILY = 1,2`,
      `VERSIONING_SYSTEM = apple-generic`, `SUPPORTED_PLATFORMS = iphoneos iphonesimulator`
- [ ] 🟠 Project level: `CLANG_CXX_LANGUAGE_STANDARD = c++20`, `USE_HERMES = true`,
      `SWIFT_ENABLE_EXPLICIT_MODULES = NO`, `EXCLUDED_ARCHS[sdk=iphonesimulator*] = ""`,
      `OTHER_CFLAGS`/`OTHER_CPLUSPLUSFLAGS` with `-DRCT_REMOVE_LEGACY_ARCH=1` + the FOLLY defines
- [ ] 🟠 Recreate **one** shared scheme named `iiGrain` (Archive → Release,
      `allowLocationSimulation = YES`). **Do not** recreate `iiGrain 1.xcscheme` or the dangling
      `iiGrainTests` reference.
- [ ] 🟢 Confirm the scheme lives in `xcshareddata/xcschemes/` — an unshared scheme breaks CI

---

## Phase 10 — iOS Podfile and native code

### 10.1 Podfile — the three customisations
- [ ] 🔴 `ENV['RCT_USE_PREBUILT_RNCORE'] = '0'` **before** `platform :ios`
      *(without it, Debug simulator builds die with "Undefined symbols for architecture arm64";
      Release archives link fine, so only local dev breaks)*
- [ ] 🔴 `pod 'react-native-maps/Google', :path => '../node_modules/react-native-maps'`
      **before** `use_react_native!`
      *(without it the app silently falls back to Apple MapKit — maps still render, so it passes a
      casual smoke test)*
- [ ] 🔴 Copy `resolve_maps_api_key`, `write_maps_xcconfig`, and the `post_install` loop over
      `installer.aggregate_targets` that appends `#include? "…/Env.generated.xcconfig"`
- [ ] 🟢 `react_native_post_install(installer, config[:reactNativePath], :mac_catalyst_enabled => false)`
- [ ] 🟢 Conditional `use_frameworks!` on `$USE_FRAMEWORKS` (off by default → static libs)
- [ ] 🟢 Confirm `ios/Config/Env.generated.xcconfig` is gitignored
- [ ] 🟡 Consider **committing `Podfile.lock`** in the new project — it is currently gitignored, so
      pod versions are not pinned across machines. Improvement, not identity.

### 10.2 `AppDelegate.swift`
- [ ] 🔴 `import GoogleMaps` *(a failure to resolve this is the intended signal that iOS fell back to
      MapKit)*
- [ ] 🔴 Copy `configureGoogleMaps()` — reads `GMSApiKey`, trims, `guard` on empty with an `NSLog`
      warning **instead of crashing**, then `GMSServices.provideAPIKey(apiKey)`
- [ ] 🔴 Call it as the **first statement** of `didFinishLaunchingWithOptions`
      *(the SDK is a process-wide singleton with no retry — unkeyed at first `GMSMapView` means every
      map stays blank for the session)*
- [ ] 🔴 `factory.startReactNative(withModuleName: "iiGrain", in: window, launchOptions:)`
- [ ] 🟢 Add **no** push registration, **no** `openURL`/`continueUserActivity` handlers

### 10.3 `pod install`
- [ ] 🟢 Run it; confirm `GoogleMaps` and `Google-Maps-iOS-Utils` appear in the new `Podfile.lock`
- [ ] 🟢 Spot-check the third-party pod versions against `03_IOS_CONFIGURATION.md` §13

---

## Phase 11 — iOS `Info.plist`, resources and assets

### 11.1 `Info.plist`
- [ ] 🔴 All **six** `NS*UsageDescription` strings **verbatim** (`05_TESTFLIGHT_READY.md` §13.1) —
      iOS hard-crashes on the corresponding API without them, and reviewers read the wording
- [ ] 🔴 `ITSAppUsesNonExemptEncryption` = `false` *(otherwise every upload stalls awaiting manual
      export-compliance answers before testers can install)*
- [ ] 🔴 `GMSApiKey` = `$(MAPS_API_KEY)` — the variable, never a literal
- [ ] 🔴 `CFBundleDisplayName` = `iiGrain` (literal string)
- [ ] 🔴 `UILaunchStoryboardName` = `LaunchScreen`
- [ ] 🔴 `UIAppFonts` — 5 entries: `MaterialCommunityIcons.ttf` + the four `Inter-*.ttf`
- [ ] 🔴 `RCTNewArchEnabled` = `true`
- [ ] 🟠 ATS dict: `NSAllowsArbitraryLoads = false`, `NSAllowsLocalNetworking = true`
- [ ] 🟠 `UISupportedInterfaceOrientations` = Portrait only; `~ipad` = all four
- [ ] 🟠 `UIUserInterfaceStyle` = `Light`; `UIViewControllerBasedStatusBarAppearance` = `false`
- [ ] 🟠 `CADisableMinimumFrameDurationOnPhone` = `true`; `UIRequiredDeviceCapabilities` = `arm64`
- [ ] 🟢 Keep `CFBundleIdentifier`/`CFBundleName`/versions as `$(…)` variables
- [ ] 🔴 Leave **absent**: `UIBackgroundModes`, `CFBundleURLTypes`, `LSApplicationQueriesSchemes`,
      `NSUserActivityTypes`, `NSFaceIDUsageDescription`, `CFBundleLocalizations`

### 11.2 `PrivacyInfo.xcprivacy`
- [ ] 🔴 Copy verbatim and add it to the **Resources** build phase
      *(3 accessed-API categories with reason codes; omitting it triggers `ITMS-91053`)*

### 11.3 Icons and launch screen
- [ ] 🔴 Copy the whole `AppIcon.appiconset/` — all **21** PNGs + `Contents.json` (IconKitchen),
      including the 1024 × 1024 marketing icon
- [ ] 🟠 Copy `LeafLogo.imageset/` (`leaf.png` 432 × 432, `template-rendering-intent: original`)
- [ ] 🟠 Copy `Images.xcassets/Contents.json`
- [ ] 🟠 Copy `LaunchScreen.storyboard` (white bg, centred 160 pt aspect-fit `LeafLogo`)
- [ ] 🟢 Add **no** alternate icons, **no** dark/tinted variants

### 11.4 Fonts and build phases
- [ ] 🟠 Run `npx react-native-asset` — do not hand-add font references
      *(iOS resolves by **PostScript name**; these are the Inter 18pt cut — substituting a different
      cut silently breaks iOS typography while Android stays fine)*
- [ ] 🔴 Verify the **7 build phases in order**: Check Pods Manifest → Sources → Frameworks →
      Resources → Bundle React Native code and images → Embed Pods Frameworks → Copy Pods Resources
- [ ] 🟠 Resources phase contains: `LaunchScreen.storyboard`, `Images.xcassets`,
      `PrivacyInfo.xcprivacy`, and the four `Inter-*.ttf`
- [ ] 🟠 Copy `ios/.xcode.env` (`export NODE_BINARY=$(command -v node)`)
- [ ] 🔴 **Do not** copy `ios/.xcode.env.local` — it hardcodes one developer's Homebrew node path
- [ ] 🟢 **Do not** copy `ios/.DS_Store`

---

## Phase 12 — Verify Android

- [ ] 🔴 `aapt2 dump badging` → `package: name='com.iigrain'`; `versionCode` correct
- [ ] 🔴 Release build signed with the **real** upload keystore;
      `apksigner verify --print-certs` SHA-1 matches the Play Console upload certificate
- [ ] 🔴 `diff` merged permission sets, old AAB vs new — must be empty
- [ ] 🔴 **Maps render on a production-signed install**, not just a debug build (the SHA-1 trap)
- [ ] 🟠 Launcher icon correct on API 24/25 **and** API 26+ devices
- [ ] 🟠 Native splash: leaf on white, no colour flash into the app
- [ ] 🟠 Status bar green (`#167A45`) with white icons; app ignores system dark mode
- [ ] 🟠 App locked to portrait
- [ ] 🟠 Inter fonts and MaterialCommunityIcons render
- [ ] 🔴 **Network requests succeed reliably on an emulator** — this is the IPv4 DNS fix working
- [ ] 🟢 `index.android.bundle` is **not** in `android/app/src/main/assets/`
- [ ] 🟢 Compare against the Phase 0 screenshots

---

## Phase 13 — Verify iOS

- [ ] 🔴 Built `.app` `CFBundleIdentifier` = `com.amitbaser.iigrain`
- [ ] 🔴 `codesign -d --entitlements :-` shows **no** `aps-environment`, **no**
      `keychain-access-groups` — only the automatic entries
- [ ] 🔴 Debug **simulator** build links (proves `RCT_USE_PREBUILT_RNCORE = '0'`)
- [ ] 🔴 Release **archive** succeeds (proves `ENABLE_USER_SCRIPT_SANDBOXING = NO`)
- [ ] 🔴 Maps render **Google** tiles honouring the custom style — **not Apple Maps**; compare
      side-by-side with Android
- [ ] 🔴 Each permission prompt appears with the correct wording and **no crash**
- [ ] 🟠 Home-screen, Settings and Spotlight icons correct on iPhone and iPad
- [ ] 🟠 Launch screen: full-colour leaf centred on white; matches Android's splash
- [ ] 🟠 App stays in light mode under system dark mode; iPhone portrait-locked, iPad rotates
- [ ] 🟠 Inter fonts and MaterialCommunityIcons render
- [ ] 🟢 `CURRENT_PROJECT_VERSION` ≥ 10; `MARKETING_VERSION` = 2.0

---

## Phase 14 — Store validation (the real proof)

### Android
- [ ] 🔴 Upload the AAB to an **internal testing** track — it must be accepted as an **update** to
      the existing listing, not rejected for a wrong key or a duplicate `versionCode`
- [ ] 🔴 Install from internal testing **over** an existing install of the old build → must update
      **in place**, not appear as a second app
- [ ] 🔴 Confirm the user stays signed in after the update
- [ ] 🟠 Confirm the Play Console permission list is unchanged
- [ ] 🔴 Verify maps render on that store-delivered install

### iOS
- [ ] 🔴 Archive and upload to App Store Connect — no validation errors, no `ITMS-91053`
- [ ] 🔴 Build reaches TestFlight **without** an export-compliance prompt (proves
      `ITSAppUsesNonExemptEncryption`)
- [ ] 🔴 TestFlight shows the **correct app icon** (proves the 1024 × 1024 marketing icon shipped)
- [ ] 🔴 **The definitive test:** install the migrated build over the device from Phase 0 → it
      installs as an **update** (one icon, not two) **and you are still signed in**. This single
      check proves bundle ID, team, and the implicit keychain access group are all intact.
- [ ] 🔴 Maps render Google tiles on the TestFlight build

---

## Phase 15 — Post-migration cleanup (separate changes, after migration is proven)

> Deliberately **after** store validation. Each of these changes behaviour; bundling them into the
> migration makes a failure impossible to attribute.

- [ ] 🟡 **Rotate the Google Maps API key** — it is committed in two tracked files
      (`AndroidManifest.xml`, `android/gradle.properties`) and is in the git history
- [ ] 🟡 **Restore the `${MAPS_API_KEY}` placeholder** on Android: uncomment the placeholder
      meta-data, delete the literal, delete the `gradle.properties` entry. The machinery already
      exists and works — it is simply bypassed
- [ ] 🟡 **Commit `ios/Podfile.lock`** so pod versions are pinned across machines
- [ ] 🟢 Resolve the RN version inconsistency (`react-native` 0.84.1 vs `@react-native/*` 0.86.0)
- [ ] 🟢 Consider a proper monochrome notification icon (currently falls back to the launcher icon,
      rendering as a white silhouette) and an adaptive `<monochrome>` layer for Android 13+ themed icons
- [ ] 🟢 Enable R8/ProGuard for release if desired (currently `enableProguardInReleaseBuilds = false`)
- [ ] 🟢 Document the keystore location and credential storage for whoever ships next

---

## Summary — the ten things most likely to break this migration

| # | Item | Symptom if missed |
|---|---|---|
| 1 | Android upload keystore + credentials (Phase 0) | Play Store rejects every upload — **no workaround** |
| 2 | Maps key SHA-1 allow-list (Phase 0) | Maps blank **in production only**; build succeeds silently |
| 3 | `versionCode` from Play Console (Phase 0) | Upload rejected as a duplicate |
| 4 | `Ipv4PreferredDns` in `MainApplication.kt` (Phase 7) | Intermittent phantom "Network Error" |
| 5 | `RCT_USE_PREBUILT_RNCORE = '0'` (Phase 10) | iOS Debug simulator link failure |
| 6 | `react-native-maps/Google` subspec (Phase 10) | **Silent** Apple-Maps fallback; custom style ignored |
| 7 | `MainActivity` triple fix (Phase 7) | No splash; invisible status bar; RNScreens crash |
| 8 | `ITSAppUsesNonExemptEncryption` (Phase 11) | Every TestFlight upload stalls |
| 9 | Accidentally enabling an iOS capability (Phase 9) | Entitlement mismatch; validation failure |
| 10 | Copying `index.android.bundle` (Phase 8) | Ships stale JavaScript that shadows the real bundle |
