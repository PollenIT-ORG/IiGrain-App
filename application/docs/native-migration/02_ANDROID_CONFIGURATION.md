# 02 — Android Configuration

> Complete audit of `application/android/`. Build outputs (`build/`, `.gradle/`, `.cxx/`) excluded.
> No file was modified.

---

## 1. Directory inventory (source-controlled / hand-authored files)

```
android/
├── build.gradle                    ← root build script + version pins
├── settings.gradle                 ← rootProject.name = 'iiGrain'
├── gradle.properties               ← arch flags, ABIs, MAPS_API_KEY (⚠ secret)
├── local.properties                ← machine-local SDK path (gitignored)
├── gradlew / gradlew.bat
├── gradle/wrapper/
│   ├── gradle-wrapper.jar
│   └── gradle-wrapper.properties   ← Gradle 9.3.1
├── link-assets-manifest.json       ← react-native-asset font bookkeeping
└── app/
    ├── build.gradle                ← THE main Android config file
    ├── debug.keystore              ← standard AOSP debug keystore (committed)
    ├── proguard-rules.pro          ← empty (comments only)
    └── src/main/
        ├── AndroidManifest.xml
        ├── java/com/iigrain/
        │   ├── MainActivity.kt
        │   └── MainApplication.kt
        ├── assets/
        │   ├── fonts/Inter-{Regular,Medium,SemiBold,Bold}.ttf
        │   └── index.android.bundle   ⚠ stale committed JS bundle — DO NOT COPY
        └── res/
            ├── values/{colors,strings,styles}.xml
            ├── mipmap-anydpi-v26/{ic_launcher,ic_launcher_round}.xml
            ├── mipmap-{m,h,x,xx,xxx}hdpi/ic_launcher{,_round,_foreground}.png
            ├── drawable-{m,h,x,xx,xxx}hdpi/splash_icon.png
            ├── drawable-mdpi/…            ← RN/react-navigation bundled assets
            ├── drawable/rn_edit_text_material.xml
            └── raw/keep.xml               ← shrinker keep-list for JS-referenced drawables
```

**There is no `src/debug/`, no `src/release/`, and no flavor source set.** A single `main` source
set drives every variant.

---

## 2. `AndroidManifest.xml` — full breakdown

**Path:** `android/app/src/main/AndroidManifest.xml`

### 2.1 Package name

The manifest has **no `package=` attribute** (modern AGP style). The package comes from
`android.namespace = "com.iigrain"` in `app/build.gradle`, and the application ID from
`defaultConfig.applicationId = "com.iigrain"`.

### 2.2 Permissions declared locally

| Permission | Reason (from in-file comments) |
|---|---|
| `android.permission.INTERNET` | API access |
| `android.permission.ACCESS_FINE_LOCATION` | Map location picker — "Use my location" / GPS centre |
| `android.permission.ACCESS_COARSE_LOCATION` | idem |
| `android.permission.CAMERA` | Camera capture (`AppImagePicker` / `react-native-image-crop-picker`) |
| `android.permission.RECORD_AUDIO` | Video recording captures audio |
| `android.permission.READ_MEDIA_IMAGES` | Android 13+ granular gallery read (photos) |
| `android.permission.READ_MEDIA_VIDEO` | Android 13+ granular gallery read (videos) |
| `android.permission.READ_EXTERNAL_STORAGE` | with `android:maxSdkVersion="32"` — pre-Android-13 fallback |

### 2.3 Features

```xml
<uses-feature android:name="android.hardware.camera" android:required="false" />
```

`required="false"` deliberately — the app still installs on camera-less devices.

### 2.4 Permissions **merged in from libraries** (not in the local manifest)

Verified against the merged manifest at
`android/app/build/intermediates/merged_manifest/debug/processDebugMainManifest/AndroidManifest.xml`.
These land in the published APK and appear in the Play Store permission list, so they matter for
store continuity even though no file in `android/` declares them:

| Permission | Contributed by |
|---|---|
| `USE_BIOMETRIC`, `USE_FINGERPRINT` | `react-native-keychain` |
| `WRITE_EXTERNAL_STORAGE` (capped), `SYSTEM_ALERT_WINDOW` | `react-native-image-crop-picker` |
| `ACCESS_NETWORK_STATE` | Google Maps / Play Services |
| `POST_NOTIFICATIONS`, `VIBRATE`, `WAKE_LOCK`, `RECEIVE_BOOT_COMPLETED`, `FOREGROUND_SERVICE`, `SCHEDULE_EXACT_ALARM`, `BROADCAST_CLOSE_SYSTEM_DIALOGS`, `ACCESS_NOTIFICATION_POLICY` | `@notifee/react-native` |
| `com.iigrain.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` (defined **and** used) | AndroidX / React Native — **auto-derived from `applicationId`** |

> The `DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` name is generated from the application ID. Keeping
> `applicationId = com.iigrain` keeps this string identical automatically — no action needed.

### 2.5 `<queries>` element (merged in)

```xml
<package android:name="com.google.android.apps.maps" />
```

Contributed by the maps stack so the app can resolve the Google Maps app for intents.

### 2.6 `<application>` attributes

| Attribute | Value |
|---|---|
| `android:name` | `.MainApplication` |
| `android:label` | `@string/app_name` → `iiGrain` |
| `android:icon` | `@mipmap/ic_launcher` |
| `android:roundIcon` | `@mipmap/ic_launcher_round` |
| `android:allowBackup` | `false` |
| `android:theme` | `@style/AppTheme` |
| `android:usesCleartextTraffic` | `${usesCleartextTraffic}` — **manifest placeholder injected by the React Native Gradle Plugin** (`true` in debug, `false` in release) |
| `android:supportsRtl` | `true` |

### 2.7 `<meta-data>` entries

```xml
<!-- Google Maps Android SDK key — CURRENTLY A HARDCODED LITERAL -->
<meta-data
    android:name="com.google.android.geo.API_KEY"
    android:value="AIzaSy…mBHOQ" />          <!-- ⚠ redacted here; literal in the file -->

<!-- Play Services client version the APK was built against -->
<meta-data
    android:name="com.google.android.gms.version"
    android:value="@integer/google_play_services_version" />
```

The file also contains a **commented-out** placeholder version of the same key element
(`android:value="${MAPS_API_KEY}"`) with a long comment explaining that a literal must never be
committed. The placeholder form is disabled; the literal form is live. See §5.

### 2.8 `<activity>` — MainActivity

| Attribute | Value | Why |
|---|---|---|
| `android:name` | `.MainActivity` | |
| `android:label` | `@string/app_name` | |
| `android:configChanges` | `keyboard\|keyboardHidden\|orientation\|screenLayout\|screenSize\|smallestScreenSize\|uiMode` | RN standard |
| `android:launchMode` | `singleTask` | |
| `android:screenOrientation` | `portrait` | Splash video is authored portrait; rotation mid-playback recreates the decoder and restarts from frame 0 |
| `android:windowSoftInputMode` | `adjustResize` | |
| `android:theme` | `@style/Theme.App.SplashScreen` | **Launch theme**, swapped to `AppTheme` by `installSplashScreen()` |
| `android:exported` | `true` | required for the launcher intent filter |

### 2.9 Intent filters

**Exactly one**, on `MainActivity`:

```xml
<intent-filter>
    <action android:name="android.intent.action.MAIN" />
    <category android:name="android.intent.category.LAUNCHER" />
</intent-filter>
```

### 2.10 Deep links

**None.** Exhaustive search found:

* no `<data android:scheme=…>` elements
* no `android.intent.action.VIEW` filters
* no `BROWSABLE` category
* no App Links / `android:autoVerify`
* no custom URL scheme
* no `assetlinks.json`

**Nothing to migrate for deep linking, and nothing to preserve.**

---

## 3. Gradle configuration

### 3.1 `android/build.gradle` (root)

```groovy
buildscript {
    ext {
        buildToolsVersion = "36.0.0"
        minSdkVersion     = 24
        compileSdkVersion = 36
        targetSdkVersion  = 36
        ndkVersion        = "27.1.12297006"
        kotlinVersion     = "2.1.20"

        // read by react-native-maps via safeExtGet()
        googlePlayServicesMapsVersion     = "19.1.0"
        googlePlayServicesBaseVersion     = "18.5.0"
        googlePlayServicesLocationVersion = "21.3.0"
    }
    repositories { google(); mavenCentral() }
    dependencies {
        classpath("com.android.tools.build:gradle")
        classpath("com.facebook.react:react-native-gradle-plugin")
        classpath("org.jetbrains.kotlin:kotlin-gradle-plugin")
    }
}
apply plugin: "com.facebook.react.rootproject"
```

Note the **version-less classpath declarations** — versions are supplied by the React Native Gradle
Plugin's included build.

### 3.2 `android/settings.gradle`

```groovy
pluginManagement { includeBuild("../node_modules/@react-native/gradle-plugin") }
plugins { id("com.facebook.react.settings") }
extensions.configure(com.facebook.react.ReactSettingsExtension){ ex -> ex.autolinkLibrariesFromCommand() }
rootProject.name = 'iiGrain'
include ':app'
includeBuild('../node_modules/@react-native/gradle-plugin')
```

### 3.3 Gradle plugins applied in `app/build.gradle`

| Plugin | Notes |
|---|---|
| `com.android.application` | |
| `org.jetbrains.kotlin.android` | |
| `com.facebook.react` | with `autolinkLibrariesWithApp()` inside the `react { }` block |
| `../../node_modules/react-native-vector-icons/fonts.gradle` | applied via `apply from:` at the bottom |

**No** `com.google.gms.google-services` plugin. **No** Firebase Crashlytics / Perf plugins.
A commented-out line at the very bottom references `react-native-config`'s `dotenv.gradle` — it is
**not** applied:

```groovy
// apply from: project(':react-native-config').projectDir.getPath() + "/dotenv.gradle"
```

(`react-native-config` is still an npm dependency and autolinks its Java package, but its Gradle
dotenv integration is disabled — env values reach JS through `react-native-dotenv`/Babel instead.)

### 3.4 `gradle.properties`

| Property | Value |
|---|---|
| `org.gradle.jvmargs` | `-Xmx2048m -XX:MaxMetaspaceSize=512m` |
| `android.useAndroidX` | `true` |
| `reactNativeArchitectures` | `armeabi-v7a,arm64-v8a,x86,x86_64` |
| `newArchEnabled` | `true` (file carries an explicit warning that `false` is unsupported on RN 0.82+) |
| `hermesEnabled` | `true` |
| `edgeToEdgeEnabled` | `false` |
| `MAPS_API_KEY` | ⚠ **live literal key** — see §5 |

`org.gradle.parallel` is present but commented out.

### 3.5 `gradle/wrapper/gradle-wrapper.properties`

```
distributionUrl=https\://services.gradle.org/distributions/gradle-9.3.1-bin.zip
networkTimeout=10000
validateDistributionUrl=true
```

### 3.6 `local.properties` (gitignored — machine-specific)

```
sdk.dir=C:\Users\Home\AppData\Local\Android\Sdk
```

**Do not copy.** Gradle/Android Studio regenerates it per machine.

---

## 4. `app/build.gradle` — the main config

### 4.1 `android { }` block

```groovy
android {
    ndkVersion       rootProject.ext.ndkVersion
    buildToolsVersion rootProject.ext.buildToolsVersion
    compileSdk       rootProject.ext.compileSdkVersion

    namespace "com.iigrain"
    defaultConfig {
        applicationId "com.iigrain"
        minSdkVersion    rootProject.ext.minSdkVersion
        targetSdkVersion rootProject.ext.targetSdkVersion
        versionCode 1
        versionName "1.0"
        manifestPlaceholders["MAPS_API_KEY"] = mapsApiKey
    }
    …
}
```

### 4.2 Manifest placeholders

| Placeholder | Set by | Consumed by |
|---|---|---|
| `MAPS_API_KEY` | `defaultConfig.manifestPlaceholders["MAPS_API_KEY"] = mapsApiKey` | the **commented-out** `com.google.android.geo.API_KEY` meta-data — i.e. currently **unused** |
| `usesCleartextTraffic` | React Native Gradle Plugin (implicit) | `<application android:usesCleartextTraffic="${usesCleartextTraffic}">` |

> The single-key subscript syntax `manifestPlaceholders["MAPS_API_KEY"] = …` is used deliberately
> (with an explanatory comment) instead of `manifestPlaceholders = [...]`, so the assignment **adds
> to** the map rather than replacing it — replacing it would wipe the RN plugin's
> `usesCleartextTraffic` entry and break the manifest merge.

### 4.3 Build-time Maps key resolution (`resolveMapsApiKey()`)

A ~20-line Groovy function in `app/build.gradle`. Resolution order, first non-blank wins:

1. `MAPS_API_KEY` **process environment variable** (the CI path — key never touches disk)
2. `application/.env`, parsed with `java.util.Properties` (`KEY=value`, `#` comments)
3. `""` — the build **succeeds** but logs a loud `[WARN]`; maps render as a blank grey grid

Rationale captured in the file: the Google Maps Android SDK reads its key from the *merged manifest
at process start*, before any JavaScript runs, so `react-native-dotenv` (which only rewrites `@env`
imports inside the JS bundle) can never supply it. This function is the bridge.

**Status: the mechanism works but is bypassed** — the manifest uses a literal, not the placeholder.

### 4.4 Signing configs

```groovy
signingConfigs {
    debug {
        storeFile file('debug.keystore')
        storePassword 'android'
        keyAlias 'androiddebugkey'
        keyPassword 'android'
    }
}
```

Only `debug` exists. There is **no `release` signing config**.

### 4.5 Build types

| Build type | `signingConfig` | `minifyEnabled` | `proguardFiles` |
|---|---|---|---|
| `debug` | `signingConfigs.debug` | (default `false`) | — |
| `release` | ⚠️ **`signingConfigs.debug`** | `enableProguardInReleaseBuilds` = **`false`** | `proguard-android.txt` + `proguard-rules.pro` |

The release block still carries the React Native template's own warning comment:
*"Caution! In production, you need to generate your own keystore file."*

### 4.6 Product flavors

**None.** No `flavorDimensions`, no `productFlavors`, no variant-specific source sets.

### 4.7 Dependencies

```groovy
dependencies {
    implementation("com.facebook.react:react-android")
    implementation("androidx.core:core-splashscreen:1.0.1")   // native splash
    if (hermesEnabled.toBoolean()) {
        implementation("com.facebook.react:hermes-android")
    } else {
        implementation jscFlavor    // io.github.react-native-community:jsc-android:2026004.+
    }
}
```

Everything else arrives through **autolinking**.

### 4.8 Vector-icons font bundling

```groovy
project.ext.vectoricons = [ iconFontNames: ['MaterialCommunityIcons.ttf'] ]
apply from: file("../../node_modules/react-native-vector-icons/fonts.gradle")
```

**Only `MaterialCommunityIcons.ttf`** is bundled from `react-native-vector-icons` — not the whole
font set. Must be reproduced or icons disappear.

---

## 5. Google Maps API key — ⚠️ security finding

There are **three** places the key lives, and they disagree with the project's own documented intent:

| # | Location | Tracked in git? | Form | Active? |
|---|---|---|---|---|
| 1 | `android/app/src/main/AndroidManifest.xml` lines 55–57 | ✅ **yes** | **literal key** | ✅ **yes — this is what the SDK reads** |
| 2 | `android/gradle.properties` line 51 | ✅ **yes** | **literal key** | ❌ no (nothing reads this property) |
| 3 | `application/.env` → `MAPS_API_KEY` | ❌ no (gitignored) | literal key | ❌ no (feeds the unused placeholder) |

The key value begins `AIzaSy` and ends `mBHOQ` (37 chars). **Deliberately not reproduced in full in
this document** — it is already over-exposed.

**Findings:**

* The elaborate `resolveMapsApiKey()` → `manifestPlaceholders` → `${MAPS_API_KEY}` plumbing that
  `app/build.gradle` and `AndroidManifest.xml` both document at length is **inert**, because the
  manifest element that consumed the placeholder is commented out and replaced by a literal.
* The key is committed in **two** tracked files, so it is in the git history and readable by anyone
  who can read the repo or unzip the APK.
* `gradle.properties` itself carries the mitigation instruction: *"Keep this restricted in Google
  Cloud by package + SHA-1/SHA-256."*

**Migration guidance (do not silently "fix" during migration):**

1. Migrate the key **as-is** first so map behaviour is provably unchanged.
2. Separately, restore the placeholder form (uncomment the `${MAPS_API_KEY}` meta-data, delete the
   literal, delete the `gradle.properties` entry) — the machinery is already there and working.
3. Confirm in Google Cloud Console that the key is restricted to package `com.iigrain` **plus the
   signing-certificate SHA-1/SHA-256 of the upload/app-signing key**. If it is restricted by SHA-1
   and your migrated build is signed with a different certificate, **maps go blank in production**
   even though the key is unchanged. This is a real migration trap — see `04_PLAY_STORE_READY.md`.
4. Rotating the key is the correct long-term answer, but it is a **separate change** from the
   migration and must not be bundled into it.

---

## 6. Firebase configuration

**There is no Firebase on Android.** Verified by exhaustive search:

| Checked for | Result |
|---|---|
| `android/app/google-services.json` | ❌ absent (anywhere in the repo) |
| `com.google.gms.google-services` Gradle plugin | ❌ not applied |
| `firebase-bom` / any `com.google.firebase:*` dependency | ❌ none |
| Crashlytics / Performance plugins | ❌ none |
| `FirebaseMessagingService` / `<service>` for FCM | ❌ none |

**Nothing to migrate.** Do not add a `google-services.json` to the fresh project — doing so would
change runtime behaviour rather than preserve it.

---

## 7. Notification configuration

Provider: **`@notifee/react-native` v9.1.8** — autolinked as
`io.invertase.notifee.NotifeePackage`.

| Aspect | Finding |
|---|---|
| Local manifest contribution | **None** — `AndroidManifest.xml` declares no notification permission, channel, receiver or service |
| Merged-manifest contribution | `NotifeeInitProvider` (a `<provider>`), plus WorkManager infrastructure (`SystemAlarmService`, `SystemJobService`, `SystemForegroundService`, `ForceStopRunnable$BroadcastReceiver`, `InitializationProvider`) |
| Permissions added by merge | `POST_NOTIFICATIONS`, `VIBRATE`, `WAKE_LOCK`, `RECEIVE_BOOT_COMPLETED`, `FOREGROUND_SERVICE`, `SCHEDULE_EXACT_ALARM`, `BROADCAST_CLOSE_SYSTEM_DIALOGS`, `ACCESS_NOTIFICATION_POLICY` |
| Custom notification icon | ❌ none — no `ic_notification` / `ic_stat_*` drawable, no `notifee_*` meta-data. Android falls back to `@mipmap/ic_launcher` |
| Notification channels | Created **from JavaScript** at runtime (Notifee API), not in native config |
| Push (FCM) | ❌ **not configured** — no Firebase, so this is **local/scheduled notifications only** |
| Colour / default channel meta-data | ❌ none |

**Migration action:** install `@notifee/react-native` and let autolinking do the rest. There is no
hand-written native notification config to carry over. Notification behaviour is entirely
JS-driven.

---

## 8. Application class, MainActivity, MainApplication

### 8.1 `MainApplication.kt` — ⚠️ contains a **custom native modification**

**Path:** `android/app/src/main/java/com/iigrain/MainApplication.kt`

Beyond the standard RN template it adds an **IPv4-preferred OkHttp DNS resolver**:

```kotlin
private object Ipv4PreferredDns : Dns {
  override fun lookup(hostname: String): List<InetAddress> {
    val addresses = Dns.SYSTEM.lookup(hostname)
    val ipv4 = addresses.filterIsInstance<Inet4Address>()
    if (ipv4.isEmpty()) return addresses
    return ipv4 + addresses.filter { it !is Inet4Address }   // IPv4 first, others as fallback
  }
}

private class Ipv4OkHttpClientFactory : OkHttpClientFactory {
  override fun createNewNetworkModuleClient(): OkHttpClient =
    OkHttpClientProvider.createClientBuilder().dns(Ipv4PreferredDns).build()
}
```

installed in `onCreate()` **before** `loadReactNative(this)`:

```kotlin
override fun onCreate() {
  super.onCreate()
  OkHttpClientProvider.setOkHttpClientFactory(Ipv4OkHttpClientFactory())
  loadReactNative(this)
}
```

**Why it exists (from the in-file comment):** the API host is dual-stack (publishes both A and AAAA
records). Many networks — especially Android emulators — advertise IPv6 but cannot route it, so an
IPv6-first attempt stalls for seconds and then surfaces to JS as a bogus transport `"Network
Error"`, even though server, TLS and certificate are all fine.

> 🔴 **This is the single most easily-lost Android customisation in the migration.** A fresh RN
> project's `MainApplication.kt` has none of it. Omitting it reintroduces intermittent
> "Network Error" failures that look like backend or JS bugs and will cost days to re-diagnose.
> **Copy this file's custom section verbatim.**

Standard parts: `class MainApplication : Application(), ReactApplication`, `reactHost` via
`getDefaultReactHost(applicationContext, PackageList(this).packages)`. No manually-added packages.

### 8.2 `MainActivity.kt` — ⚠️ contains **two custom modifications**

**Path:** `android/app/src/main/java/com/iigrain/MainActivity.kt`

```kotlin
override fun onCreate(savedInstanceState: Bundle?) {
  installSplashScreen()                                        // ① must be FIRST call
  WindowCompat.setDecorFitsSystemWindows(window, false)         // ② edge-to-edge on all versions
  super.onCreate(null)                                         // ③ null, not savedInstanceState
}

override fun getMainComponentName(): String = "iiGrain"

override fun createReactActivityDelegate(): ReactActivityDelegate =
    DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
```

| # | Modification | Why (from comments) |
|---|---|---|
| ① | `installSplashScreen()` **before** `super.onCreate()` | Swaps the activity from `Theme.App.SplashScreen` (leaf on white) to `AppTheme` once RN is ready. Must be the first call in `onCreate`. |
| ② | `WindowCompat.setDecorFitsSystemWindows(window, false)` | Draws content behind system bars on **every** Android version. Critically, it makes window insets (status-bar height) reach `react-native-safe-area-context`, so the JS `StatusBarBackground` strip gets a correct height — without it the primary-green status bar collapses to a 0-height, invisible strip. |
| ③ | `super.onCreate(null)` instead of `super.onCreate(savedInstanceState)` | `react-native-screens` requirement — avoids a fragment state-restoration crash. RN restores its own JS state. |

**All three must be reproduced.** Each has a visible, hard-to-diagnose failure mode if dropped.

---

## 9. Splash screen

Implementation: **`androidx.core:core-splashscreen:1.0.1`** (the Android 12 SplashScreen API,
backported to all supported versions).

| Piece | Value |
|---|---|
| Dependency | `androidx.core:core-splashscreen:1.0.1` in `app/build.gradle` |
| Launch theme | `@style/Theme.App.SplashScreen` on `MainActivity` |
| Theme parent | `Theme.SplashScreen` |
| `windowSplashScreenBackground` | `@color/splash_background` = `#FFFFFF` |
| `windowSplashScreenAnimatedIcon` | `@drawable/splash_icon` |
| `postSplashScreenTheme` | `@style/AppTheme` |
| Install call | `installSplashScreen()`, first line of `MainActivity.onCreate` |
| Icon densities | `drawable-{mdpi…xxxhdpi}/splash_icon.png` — 288 / 432 / 576 / 864 / 1152 px |
| Generator | `scripts/gen_splash_assets.py` from `branding/splash_master.png` |
| On-screen leaf size | **67 dp** — deliberately identical to iOS |

The Python generator is the **single source of truth for both platforms'** native splash. Its
docstring documents the sizing maths: Android's SplashScreen API scales the drawable into a 288 dp
icon slot, so the drawable is authored as a 288 dp canvas with the leaf sized to 67 dp and centred
(the transparent margin is the safe zone that keeps the leaf inside the circular mask Android 12+
applies).

There is a second, **JS-level** splash (a video, `SPLASH.backgroundColor`) that runs after the
native one. Out of scope here, but it is why `splash_background`, `AppTheme`'s `windowBackground`
and the iOS LaunchScreen are all pure white — so the startup chain never flashes a different colour.
See `application/SPLASH.md` and `docs/IOS_SPLASH_VIDEO_SETUP.md`.

---

## 10. Icons and adaptive icons

Full detail in `06_APP_ICONS.md`. Summary:

| Resource | Densities / files |
|---|---|
| `@mipmap/ic_launcher` | `mipmap-{m,h,x,xx,xxx}hdpi/ic_launcher.png` — 48/72/96/144/192 px |
| `@mipmap/ic_launcher_round` | same densities — 48/72/96/144/192 px |
| `@mipmap/ic_launcher_foreground` | same densities — 108/162/216/324/432 px |
| Adaptive icon (API 26+) | `mipmap-anydpi-v26/ic_launcher.xml` and `ic_launcher_round.xml` |
| Adaptive background | `@color/ic_launcher_background` = `#FFFFFF` (a **colour**, not a drawable) |
| Adaptive foreground | `@mipmap/ic_launcher_foreground` |
| Monochrome layer | ❌ none (no themed-icon support on Android 13+) |

Both `ic_launcher.xml` and `ic_launcher_round.xml` are byte-identical:

```xml
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
</adaptive-icon>
```

---

## 11. Themes and styles

**Path:** `android/app/src/main/res/values/styles.xml`

### `AppTheme` (parent `Theme.AppCompat.Light.NoActionBar`)

| Item | Value | Purpose |
|---|---|---|
| `android:editTextBackground` | `@drawable/rn_edit_text_material` | RN template default |
| `android:windowBackground` | `@android:color/white` | First frames before JS paints are white — never a dark frame an OEM would cover with its own loading ring |
| `android:forceDarkAllowed` | `false` | Force light mode app-wide |
| `android:statusBarColor` | `#167A45` (primary green) | Direct colouring on Android < 15 |
| `android:windowLightStatusBar` | `false` | Keeps clock/icons **white** for contrast on the dark green |

> The comment records that Android 15+ forces edge-to-edge and **ignores `statusBarColor`** — there,
> the JS `StatusBarBackground` overlay paints the strip instead. This is why the `MainActivity`
> inset fix (§8.2 ②) is load-bearing.

### `Theme.App.SplashScreen` (parent `Theme.SplashScreen`)

See §9.

### `values/colors.xml`

| Colour | Value | Purpose |
|---|---|---|
| `ic_launcher_background` | `#FFFFFF` | Adaptive launcher icon background |
| `splash_background` | `#FFFFFF` | Native splash background; matches iOS LaunchScreen + JS splash video |

### `values/strings.xml`

```xml
<resources>
    <string name="app_name">iiGrain</string>
</resources>
```

Single string. No localisation, no other `values-*` folders.

---

## 12. Network security config

**None.** There is no `res/xml/network_security_config.xml` and no
`android:networkSecurityConfig` attribute anywhere.

Cleartext traffic is governed solely by
`android:usesCleartextTraffic="${usesCleartextTraffic}"`, whose placeholder the React Native Gradle
Plugin fills as `true` for debug and `false` for release. **Nothing to migrate.**

---

## 13. ProGuard / R8

| Aspect | Finding |
|---|---|
| `enableProguardInReleaseBuilds` | **`false`** — release builds are **not** minified or obfuscated |
| `proguardFiles` | `getDefaultProguardFile("proguard-android.txt")` + `proguard-rules.pro` (configured but inactive while `minifyEnabled` is false) |
| `app/proguard-rules.pro` | **Effectively empty** — 11 lines, all comments, zero rules |
| Resource shrinking | Not enabled |
| `res/raw/keep.xml` | ✅ **present and load-bearing** |

### `res/raw/keep.xml`

A `tools:keep` list protecting drawables that are only referenced from JavaScript (so the resource
shrinker cannot see the reference and would strip them):

```
@drawable/src_assets_images_iigrainlogo
@drawable/src_assets_images_iigrainlogoboth
@drawable/src_assets_images_splashloader
@drawable/node_modules_reactnavigation_elements_lib_module_assets_searchicon
@drawable/node_modules_reactnavigation_elements_lib_module_assets_backicon
@drawable/node_modules_reactnavigation_elements_lib_module_assets_backiconmask
@drawable/node_modules_reactnavigation_elements_lib_module_assets_clearicon
@drawable/node_modules_reactnavigation_elements_lib_module_assets_closeicon
@drawable/node_modules_reactnavigation_drawer_lib_module_views_assets_toggledrawericon
```

> **Do not hand-copy `keep.xml`, and do not hand-copy the `drawable-*/src_assets_*` /
> `drawable-*/node_modules_*` PNGs.** Both are **generated by the React Native bundler** when it
> processes `require()`d images. They regenerate on the first release build of the fresh project.
> Copying them stale risks names that no longer match what the new bundler emits.

---

## 14. Custom native modules

**No bespoke native module packages exist.** There is no `ReactPackage` implementation, no
`@ReactModule`, no TurboModule spec, and no custom Fabric component authored in this project.

What *does* exist is **native customisation inside the two template files** (§8) — the IPv4 DNS
factory and the three `MainActivity.onCreate` modifications. Those are the "custom native code" of
this project.

### Autolinked native packages (24, from the generated `PackageList.java`)

```
MainReactPackage                                    (React Native core)
io.invertase.notifee.NotifeePackage                 @notifee/react-native
org.asyncstorage.AsyncStoragePackage                @react-native-async-storage/async-storage
com.reactcommunity.rndatetimepicker.RNDateTimePickerPackage
com.reactnativecommunity.geolocation.GeolocationPackage
com.reactnativedocumentpicker.RNDocumentPickerPackage
com.airbnb.android.react.lottie.LottiePackage       lottie-react-native
com.lugg.RNCConfig.RNCConfigPackage                 react-native-config
com.rnfs.RNFSPackage                                react-native-fs
com.swmansion.gesturehandler.RNGestureHandlerPackage
com.reactnative.ivpusic.imagepicker.PickerPackage   react-native-image-crop-picker
com.imagepicker.ImagePickerPackage                  react-native-image-picker
com.reactnativekeyboardcontroller.KeyboardControllerPackage
com.oblador.keychain.KeychainPackage                react-native-keychain
com.BV.LinearGradient.LinearGradientPackage
com.rnmaps.maps.MapsPackage                         react-native-maps
com.swmansion.reanimated.ReanimatedPackage
com.th3rdwave.safeareacontext.SafeAreaContextPackage
com.swmansion.rnscreens.RNScreensPackage
com.horcrux.svg.SvgPackage                          react-native-svg
com.oblador.vectoricons.VectorIconsPackage
com.brentvatne.react.ReactVideoPackage              react-native-video
com.reactnativecommunity.webview.RNCWebViewPackage
com.swmansion.worklets.WorkletsPackage
```

These need **no** manual registration — `autolinkLibrariesWithApp()` handles them. Listed here so
you can verify parity after `npm install` in the fresh project.

`patches/` exists but is **empty** — no `patch-package` patches to carry over, despite the
`postinstall: patch-package` script.

---

## 15. Fonts

| Location | Files |
|---|---|
| `android/app/src/main/assets/fonts/` | `Inter-Regular.ttf`, `Inter-Medium.ttf`, `Inter-SemiBold.ttf`, `Inter-Bold.ttf` |
| Bundled by vector-icons | `MaterialCommunityIcons.ttf` (via `fonts.gradle`, §4.8) |
| Bookkeeping | `android/link-assets-manifest.json` — SHA-1s of the four Inter files, written by `react-native-asset` |
| Source of the fonts | `src/assets/fonts/` (declared in `react-native.config.js` → `assets`) |

Android resolves fonts by **filename** (`Inter-Bold.ttf` → family `Inter-Bold`). Reproduce by
running `npx react-native-asset` in the fresh project rather than hand-copying, so the manifest
stays consistent.

---

## 16. Every Android file that differs from a stock RN template

Ordered by migration risk.

| # | File | Modification | Risk if missed |
|---|---|---|---|
| 1 | `app/src/main/java/com/iigrain/MainApplication.kt` | IPv4-preferred OkHttp DNS factory | 🔴 Intermittent phantom "Network Error" |
| 2 | `app/src/main/java/com/iigrain/MainActivity.kt` | `installSplashScreen()`; `setDecorFitsSystemWindows(false)`; `super.onCreate(null)`; component name `iiGrain` | 🔴 No splash; invisible status bar; RNScreens crash |
| 3 | `app/src/main/AndroidManifest.xml` | 8 permissions, camera feature, Maps key meta-data, portrait lock, `singleTask`, `allowBackup=false`, splash launch theme | 🔴 Permissions/maps/orientation all break |
| 4 | `app/build.gradle` | `namespace`/`applicationId` `com.iigrain`; `resolveMapsApiKey()`; manifest placeholder; splashscreen dep; vector-icons font list; release build type | 🔴 Identity + maps + icons |
| 5 | `build.gradle` (root) | SDK 24/36/36, BT 36.0.0, NDK 27.1.12297006, Kotlin 2.1.20, **3 pinned Play Services versions** | 🔴 Un-pinned Maps SDK; wrong SDK levels |
| 6 | `gradle.properties` | `newArchEnabled=true`, `hermesEnabled=true`, `edgeToEdgeEnabled=false`, ABI list, `MAPS_API_KEY` | 🔴 Broken new-arch build |
| 7 | `app/src/main/res/values/styles.xml` | `AppTheme` (white bg, force-light, green status bar) + `Theme.App.SplashScreen` | 🟠 No splash; wrong status bar |
| 8 | `app/src/main/res/values/colors.xml` | `ic_launcher_background`, `splash_background` | 🟠 Icon/splash background wrong |
| 9 | `app/src/main/res/values/strings.xml` | `app_name` = `iiGrain` | 🔴 Wrong launcher label |
| 10 | `app/src/main/res/mipmap-anydpi-v26/ic_launcher{,_round}.xml` | Adaptive icon definitions | 🔴 Wrong icon on API 26+ |
| 11 | `app/src/main/res/mipmap-*/ic_launcher*.png` (15 files) | Real branded launcher icons | 🔴 RN default icon ships to Play Store |
| 12 | `app/src/main/res/drawable-*/splash_icon.png` (5 files) | Generated splash leaf | 🟠 Blank splash |
| 13 | `settings.gradle` | `rootProject.name = 'iiGrain'` | 🟢 Cosmetic |
| 14 | `gradle/wrapper/gradle-wrapper.properties` | Gradle 9.3.1 | 🟠 Toolchain drift |
| 15 | `app/src/main/assets/fonts/*.ttf` (4) | Inter family | 🟠 Typography falls back to system font |
| 16 | `link-assets-manifest.json` | Font SHA-1 bookkeeping | 🟢 Regenerate with `react-native-asset` |
| 17 | `app/src/main/res/raw/keep.xml` | Shrinker keep-list | 🟢 **Regenerated** — do not hand-copy |
| 18 | `app/src/main/res/drawable-*/src_assets_*`, `…/node_modules_*` | Bundler-emitted JS image assets | 🟢 **Regenerated** — do not hand-copy |
| 19 | `app/debug.keystore` | Standard AOSP debug keystore | 🟢 Copy for stable debug SHA-1, or accept a new one |
| 20 | `app/proguard-rules.pro` | Comments only | 🟢 Nothing to carry |
| 21 | `app/src/main/assets/index.android.bundle` | **Stale committed JS bundle** | 🔴 **DO NOT COPY** — shadows the freshly built bundle, shipping old JS |
| 22 | `local.properties` | Machine-local SDK path | 🟢 Do not copy |

---

## 17. Android-side risks to resolve before migrating

1. 🔴 **No release signing config.** Obtain the real upload keystore + credentials and confirm Play
   App Signing status. Without this the Play listing cannot be updated. → `04_PLAY_STORE_READY.md`
2. 🔴 **Maps key may be SHA-1-restricted.** If the migrated build is signed with a different
   certificate, maps go blank in production even with an unchanged key. Verify restrictions in
   Google Cloud Console. → §5
3. 🔴 **`versionCode` is `1`.** The true next value must be read from the Play Console.
4. 🔴 **Stale `index.android.bundle` is committed.** Exclude it explicitly.
5. 🟡 **Maps key committed in two tracked files.** Rotate + restore the placeholder mechanism as a
   follow-up change, separate from the migration.
