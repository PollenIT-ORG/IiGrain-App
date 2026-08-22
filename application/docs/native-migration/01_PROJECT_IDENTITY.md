# 01 — Project Identity

> **Audit date:** 2026-07-30
> **Audited tree:** `c:\farmer-app\application` (React Native project root)
> **Scope:** `android/` and `ios/` only. `src/` and all JS/TS business logic deliberately ignored.
> **Nothing in this audit modified the project.**

---

## 1. Canonical identity table

These are the values a fresh React Native project **must** reproduce exactly.

| Field | Value | Source of truth |
|---|---|---|
| **Project Name** | `iiGrain` | `app.json` → `name`; `android/settings.gradle` → `rootProject.name` |
| **Display Name** | `iiGrain` | `app.json` → `displayName` |
| **npm package name** | `iiGrain` | `package.json` → `name` |
| **npm package version** | `0.0.1` (vestigial — not shipped anywhere) | `package.json` → `version` |
| **JS root component name** | `iiGrain` | `MainActivity.kt` → `getMainComponentName()`; `AppDelegate.swift` → `withModuleName:` |
| **Android Application ID** | `com.iigrain` | `android/app/build.gradle` → `defaultConfig.applicationId` |
| **Android Namespace** | `com.iigrain` | `android/app/build.gradle` → `android.namespace` |
| **Android Kotlin package** | `com.iigrain` | `android/app/src/main/java/com/iigrain/` |
| **Android label (`app_name`)** | `iiGrain` | `android/app/src/main/res/values/strings.xml` |
| **iOS Bundle Identifier** | `com.amitbaser.iigrain` | `project.pbxproj` → `PRODUCT_BUNDLE_IDENTIFIER` (Debug **and** Release) |
| **iOS Display Name** | `iiGrain` | `ios/iiGrain/Info.plist` → `CFBundleDisplayName` (literal string) |
| **iOS Bundle Name** | `$(PRODUCT_NAME)` → `iiGrain` | `Info.plist` → `CFBundleName` |
| **Target Name** | `iiGrain` | `project.pbxproj` → `PBXNativeTarget.name` (UUID `13B07F861A680F5B00A75B9A`) |
| **Scheme Name** | `iiGrain` | `ios/iiGrain.xcodeproj/xcshareddata/xcschemes/iiGrain.xcscheme` |
| **Product Name** | `iiGrain` | `project.pbxproj` → `PRODUCT_NAME` |
| **Product / app bundle** | `iiGrain.app` | `project.pbxproj` → `productReference` |
| **Xcode project name** | `iiGrain.xcodeproj` | `ios/iiGrain.xcodeproj` |
| **Xcode workspace name** | `iiGrain.xcworkspace` | `ios/iiGrain.xcworkspace` |
| **Organization Identifier** | *Not stored in the project.* Inferable only as `com.amitbaser` from the bundle ID prefix. | No `ORGANIZATIONNAME` in `project.pbxproj` |

### ⚠️ The two platforms do NOT share an identifier

| Platform | Identifier |
|---|---|
| Android | `com.iigrain` |
| iOS | `com.amitbaser.iigrain` |

This is **intentional-by-history, not a bug to fix during migration.** Changing either one
breaks store continuity: a new Android `applicationId` becomes a brand-new Play Store listing,
and a new iOS bundle ID becomes a brand-new App Store record. **Copy both verbatim, mismatch
included.** See `04_PLAY_STORE_READY.md` and `05_TESTFLIGHT_READY.md`.

---

## 2. Versioning

| Field | Android | iOS |
|---|---|---|
| **Marketing version** | `versionName "1.0"` | `MARKETING_VERSION = 2.0` |
| **Build number** | `versionCode 1` | `CURRENT_PROJECT_VERSION = 9` |
| **Bundle Short Version** | n/a | `CFBundleShortVersionString = $(MARKETING_VERSION)` → `2.0` |
| **Bundle Version** | n/a | `CFBundleVersion = $(CURRENT_PROJECT_VERSION)` → `9` |
| **Versioning system** | Gradle literals in `android/app/build.gradle` | `VERSIONING_SYSTEM = apple-generic` |

**Sources:** `android/app/build.gradle` lines 139–140; `project.pbxproj` (both Debug and Release
configurations of the `iiGrain` target carry identical `MARKETING_VERSION` / `CURRENT_PROJECT_VERSION`).

### Reading the version numbers

* **iOS `2.0 (9)`** — nine build submissions against marketing version 2.0. Consistent with an app
  that has been iterated through TestFlight.
* **Android `1.0 (1)`** — still at the React Native template defaults. `versionCode 1` has never
  been incremented in this repo.

> **Migration consequence:** the next Play Store upload must use a `versionCode` **strictly greater
> than the highest `versionCode` already accepted by Google Play** — which cannot be determined from
> this repository. Read it from the Play Console before the first migrated upload. Do not assume
> `2` is safe. Likewise, the next TestFlight upload needs `CURRENT_PROJECT_VERSION` ≥ `10` (or a
> higher `MARKETING_VERSION`), because build numbers are immutable per version on App Store Connect.

---

## 3. Android SDK levels and toolchain

All declared in `android/build.gradle` → `buildscript.ext`, consumed by `android/app/build.gradle`.

| Field | Value |
|---|---|
| **Minimum Android SDK** (`minSdkVersion`) | `24` (Android 7.0 Nougat) |
| **Target Android SDK** (`targetSdkVersion`) | `36` |
| **Compile SDK** (`compileSdkVersion`) | `36` |
| **Build Tools Version** | `36.0.0` |
| **NDK Version** | `27.1.12297006` |
| **Kotlin Version** | `2.1.20` |
| **Gradle Wrapper** | `9.3.1` (`gradle-9.3.1-bin.zip`) |
| **Android Gradle Plugin** | version-less classpath — resolved by the React Native Gradle Plugin |
| **JVM args** | `-Xmx2048m -XX:MaxMetaspaceSize=512m` |
| **ABIs built** | `armeabi-v7a,arm64-v8a,x86,x86_64` |

### Pinned Google Play Services versions

Declared explicitly in `android/build.gradle` (read by `react-native-maps` via its `safeExtGet()`
helper) so that a library bump cannot silently change the Maps SDK inside the APK:

| Ext property | Value | Purpose |
|---|---|---|
| `googlePlayServicesMapsVersion` | `19.1.0` | MapView / tile renderer |
| `googlePlayServicesBaseVersion` | `18.5.0` | `GoogleApiAvailability`, "update Play services" dialog |
| `googlePlayServicesLocationVersion` | `21.3.0` | `FusedLocationProvider` (`showsUserLocation`) |

**These must be carried over.** Dropping them does not break the build — it silently un-pins the
Maps SDK.

---

## 4. iOS deployment and toolchain

| Field | Value | Source |
|---|---|---|
| **Minimum iOS Version / Deployment Target** | `15.1` | `IPHONEOS_DEPLOYMENT_TARGET` — set at **both** project level and target level (Debug + Release) |
| **Podfile platform** | `min_ios_version_supported` (resolved from the installed React Native) | `ios/Podfile` line 28 |
| **Swift Version** | `5.0` | `SWIFT_VERSION` (target level, Debug + Release) |
| **C++ standard** | `c++20` | `CLANG_CXX_LANGUAGE_STANDARD` (project level) |
| **C++ library** | `libc++` | `CLANG_CXX_LIBRARY` |
| **SDKROOT** | `iphoneos` | project level |
| **Supported platforms** | `iphoneos iphonesimulator` | target level |
| **Targeted device family** | `1,2` (iPhone **and** iPad) | `TARGETED_DEVICE_FAMILY` |
| **Required device capability** | `arm64` | `Info.plist` → `UIRequiredDeviceCapabilities` |
| **Bitcode** | `ENABLE_BITCODE = NO` (Debug only; absent in Release) | target level |
| **Hermes** | `USE_HERMES = true` | project level, both configs |
| **Xcode compatibility** | `Xcode 12.0`, `objectVersion = 54`, `LastUpgradeCheck = 1210` | `project.pbxproj` |
| **Last Swift migration** | `1120` | `PBXProject.TargetAttributes` |
| **CocoaPods** | `1.16.2` | `ios/Podfile.lock` |

---

## 5. Signing identity

### iOS

| Field | Value | Source |
|---|---|---|
| **Team ID** | `SADMK33W84` | `project.pbxproj` → `DEVELOPMENT_TEAM` (Debug **and** Release) |
| **Signing Team** | Same — `SADMK33W84`. The human-readable team name is **not** stored in the project; read it from the Apple Developer portal. | — |
| **Code Sign Style** | `Automatic` (target level, both configs) | `CODE_SIGN_STYLE` |
| **Code Sign Identity** | `iPhone Developer` for `sdk=iphoneos*` (project level) | `CODE_SIGN_IDENTITY[sdk=iphoneos*]` |
| **Provisioning Profile** | **None specified in the project.** No `PROVISIONING_PROFILE`, no `PROVISIONING_PROFILE_SPECIFIER`, no `CODE_SIGN_ENTITLEMENTS` key anywhere in `project.pbxproj`. No `.mobileprovision` file exists in the repository. | verified by exhaustive search |

Because `CODE_SIGN_STYLE = Automatic` with a `DEVELOPMENT_TEAM` set, **Xcode manages the
provisioning profile server-side.** There is nothing profile-shaped to copy: on the fresh project
you set the team to `SADMK33W84`, leave signing automatic, and Xcode regenerates/downloads the
matching profile for `com.amitbaser.iigrain`. This is the intended path and preserves TestFlight
continuity.

### Android

| Field | Value | Source |
|---|---|---|
| **Declared signing configs** | `debug` **only** | `android/app/build.gradle` `signingConfigs { debug { … } }` |
| **Debug keystore** | `android/app/debug.keystore` — the standard AOSP debug keystore; committed to git via the `!debug.keystore` exception in `.gitignore`. Credentials are the well-known Android defaults and are inline in `build.gradle`. **Not a secret, and not the store identity.** | — |
| **Release signing config** | ⚠️ **`signingConfig signingConfigs.debug`** — the `release` build type is wired to the *debug* keystore. | `android/app/build.gradle` line 163 |
| **Release keystore present in tree** | `application/your_key_name.keystore` (2 744 bytes) — **untracked** (matched by `*.keystore` in `.gitignore`). Referenced by no Gradle file. | verified via `git ls-files` |

> ### ⚠️ Critical Android signing finding
>
> No release signing config exists in this project. Whatever binary is live on the Play Store was
> **not** signed by this Gradle configuration — it must have been signed out-of-band (Android
> Studio's *Generate Signed Bundle* dialog, a CI secret, and/or Google Play App Signing) most
> likely using `application/your_key_name.keystore`.
>
> **The upload key is the one thing that cannot be recovered from this repository.** Before
> migrating, confirm with whoever publishes the app: (a) the upload keystore file, (b) its store
> password, key alias and key password, and (c) whether Play App Signing is enabled. Losing the
> upload key means the existing Play listing can never be updated again (recovery requires a
> Google-assisted key reset, only possible if Play App Signing is on).
>
> Full detail and required actions: `04_PLAY_STORE_READY.md` → *Signing*.

---

## 6. React Native and architecture

| Field | Value |
|---|---|
| **React Native** | `0.84.1` (`package.json` `^0.84.1`; `Podfile.lock` confirms `0.84.1`) |
| **React** | `19.2.3` |
| **Hermes** | Enabled — `hermesEnabled=true` (Android), `USE_HERMES = true` (iOS) |
| **Hermes engine pod** | `250829098.0.9` (tag `hermes-v250829098.0.9`) |
| **New Architecture** | **Enabled on both platforms** — `newArchEnabled=true` (`gradle.properties`), `RCTNewArchEnabled = true` (`Info.plist`) |
| **Legacy arch removal flag** | `-DRCT_REMOVE_LEGACY_ARCH=1` in `OTHER_CFLAGS` / `OTHER_CPLUSPLUSFLAGS` (project level, both configs) |
| **Edge-to-edge (Android flag)** | `edgeToEdgeEnabled=false` — but `MainActivity.onCreate` calls `WindowCompat.setDecorFitsSystemWindows(window, false)` manually |
| **JSC fallback flavor** | `io.github.react-native-community:jsc-android:2026004.+` (unused while Hermes is on) |

> `gradle.properties` carries an explicit warning that `newArchEnabled=false` is unsupported on
> RN 0.82+ and produces a half-configured build. Keep it `true`.

### Toolchain version mismatch (informational)

`package.json` pins runtime `react-native: ^0.84.1`, but the `@react-native/*` **dev** tooling
(`babel-preset`, `eslint-config`, `jest-preset`, `metro-config`, `typescript-config`) is pinned to
`0.86.0`. This is a pre-existing inconsistency in JS tooling, out of scope for native config, but
it matters when you run `npx @react-native-community/cli init` for the fresh project — **initialise
at the RN version you intend to ship (`0.84.1`) rather than letting the CLI pick latest**, or the
native templates you are about to overlay will not match.

---

## 7. Quick-reference: identity values to type into a fresh project

```
Project / app name ................ iiGrain
JS component name ................. iiGrain
Android applicationId ............. com.iigrain
Android namespace ................. com.iigrain
Android package dir ............... android/app/src/main/java/com/iigrain/
Android versionCode ............... 1        (verify against Play Console before upload)
Android versionName ............... 1.0
Android minSdk / target / compile . 24 / 36 / 36
iOS bundle identifier ............. com.amitbaser.iigrain
iOS display name .................. iiGrain
iOS target / scheme / product ..... iiGrain
iOS MARKETING_VERSION ............. 2.0
iOS CURRENT_PROJECT_VERSION ....... 9        (next upload needs >= 10)
iOS deployment target ............. 15.1
iOS DEVELOPMENT_TEAM .............. SADMK33W84
iOS SWIFT_VERSION ................. 5.0
```

---

## 8. Identity-relevant anomalies found during the audit

| # | Finding | Impact |
|---|---|---|
| 1 | Release build type signed with the **debug** keystore | 🔴 Blocks a correct Play Store release from this config — see §5 |
| 2 | Android `applicationId` ≠ iOS bundle ID | 🟡 Expected; must be preserved as-is, not "harmonised" |
| 3 | Android `versionCode` still `1` | 🟡 True next value must come from the Play Console |
| 4 | Google Maps API key **hardcoded** in `AndroidManifest.xml` and `android/gradle.properties`, both tracked in git — despite elaborate build-time plumbing designed to keep it out | 🔴 Live key exposed in VCS; see `02_ANDROID_CONFIGURATION.md` §5 |
| 5 | Duplicate scheme `iiGrain 1.xcscheme` (Xcode-upgrade artefact, `LastUpgradeVersion 2620`) | 🟢 Do not recreate; only `iiGrain.xcscheme` is canonical |
| 6 | `iiGrain.xcscheme` references an `iiGrainTests` target (`00E356ED1AD99517003FC87E`) that **does not exist** in `project.pbxproj` | 🟢 Dangling test reference; drop it in the fresh project |
| 7 | No `ORGANIZATIONNAME` / organization identifier stored | 🟢 Cosmetic; supply `com.amitbaser` if Xcode prompts |
| 8 | A stale `index.android.bundle` is committed under `android/app/src/main/assets/` | 🟡 Do **not** copy — it shadows the freshly built bundle. See `08_FILE_REFERENCE.md` |

---

## Cross-references

* Android detail → `02_ANDROID_CONFIGURATION.md`
* iOS detail → `03_IOS_CONFIGURATION.md`
* Play Store continuity → `04_PLAY_STORE_READY.md`
* TestFlight continuity → `05_TESTFLIGHT_READY.md`
* Icons → `06_APP_ICONS.md`
* Ordered execution plan → `07_MIGRATION_CHECKLIST.md`
* Per-file copy/recreate decisions → `08_FILE_REFERENCE.md`
