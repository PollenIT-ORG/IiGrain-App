# 08 — File Reference

> Every hand-authored file in `android/` and `ios/`, plus the root-level files that drive native
> configuration, with an explicit copy / recreate / optional / critical decision for each.
>
> Paths are relative to the React Native project root: **`c:\farmer-app\application`**.

---

## Column meanings

| Column | Meaning |
|---|---|
| **Must Copy?** | Copy the file byte-for-byte (or copy its custom sections into the fresh template file) |
| **Must Recreate?** | Do not copy — the fresh project generates its own, or you set the values by hand in the new template |
| **Optional?** | Migration succeeds without it |
| **Critical?** | Getting it wrong breaks store identity, crashes the app, or fails the build |

Many files are **both** "copy" and "recreate" in a nuanced way — e.g. `MainActivity.kt` should be the
fresh template's file with the three custom modifications transplanted in, not a blind overwrite.
Those rows say **Merge** and the Reason column explains what to transplant.

---

## 1. Root-level files driving native config

| File Path | Purpose | Must Copy? | Must Recreate? | Optional? | Critical? | Reason |
|---|---|---|---|---|---|---|
| `package.json` | Declares the 39 runtime + 20 dev dependencies that drive all autolinking, pod resolution and Gradle deps | **Merge** | No | No | 🔴 **Yes** | Every native module in both platforms derives from this list. Different versions = a different native surface. Copy the two dependency blocks; keep the fresh project's own `name`/`scripts` skeleton, then re-add `postinstall: patch-package` |
| `app.json` | `{ "name": "iiGrain", "displayName": "iiGrain" }` | **Yes** | No | No | 🟠 | Drives the RN CLI's notion of app name; `displayName` is the user-visible label |
| `react-native.config.js` | `assets: ['./src/assets/fonts']` | **Yes** | No | No | 🟠 | Without it `react-native-asset` will not link the Inter fonts on either platform |
| `.gitignore` | Ignore rules — keystores, `.env`, `ios/Config/Env.generated.xcconfig`, `Podfile.lock` | **Yes** | No | No | 🔴 **Yes** | The keystore and Maps-key ignore rules are what keep secrets out of VCS. Losing them risks committing the upload keystore |
| `.env` | `API_BASE_URL`, `API_PREFIX`, `API_TIMEOUT`, `MAPS_API_KEY` | **Yes** (out-of-band) | No | No | 🔴 **Yes** | `MAPS_API_KEY` feeds both platforms' build-time key resolution. Gitignored — transfer securely, never via git |
| `.env.example` | Template documenting required env keys | **Yes** | No | Yes | 🟢 | Developer convenience |
| `scripts/gen_splash_assets.py` | Single source of truth generating **both** platforms' splash assets from one master | **Yes** | No | No | 🟠 | Without it the two platforms' splash screens will drift — the exact problem it was written to prevent |
| `branding/splash_master.png` | 59 835-byte master logo for the splash generator | **Yes** | No | No | 🟠 | The only source from which `splash_icon.png` (×5) and `leaf.png` can be regenerated |
| `patches/` | `patch-package` patch directory | No | No | Yes | 🟢 | **Empty** — nothing to carry over |
| `your_key_name.keystore` | Candidate Android release/upload keystore (untracked; referenced by no Gradle file) | **Verify first** | No | No | 🔴 **Yes** | May be the real upload key. **Confirm before relying on it** — see `04_PLAY_STORE_READY.md` §2. Never commit it |
| `babel.config.js`, `metro.config.js`, `tsconfig.json`, `jest.config.js`, `.eslintrc.js`, `.prettierrc.js`, `.watchmanconfig`, `Gemfile`, `.bundle/` | JS tooling | Out of scope | — | — | — | Not native configuration |

---

## 2. Android — root and Gradle

| File Path | Purpose | Must Copy? | Must Recreate? | Optional? | Critical? | Reason |
|---|---|---|---|---|---|---|
| `android/build.gradle` | SDK levels (24/36/36), Build Tools 36.0.0, NDK 27.1.12297006, Kotlin 2.1.20, **3 pinned Play Services versions** | **Merge** | No | No | 🔴 **Yes** | Wrong SDK levels change store eligibility. Omitting the `googlePlayServices*Version` pins silently un-pins the Maps SDK inside the APK |
| `android/app/build.gradle` | `applicationId`/`namespace` `com.iigrain`, versionCode/Name, `resolveMapsApiKey()`, manifest placeholder, splashscreen dep, vector-icons font list, signing configs, build types | **Merge** | No | No | 🔴 **Yes** | **The single most important Android file.** Carries the Play Store identity, the Maps key plumbing and the icon-font bundling |
| `android/gradle.properties` | `newArchEnabled=true`, `hermesEnabled=true`, `edgeToEdgeEnabled=false`, ABI list, JVM args | **Merge** | No | No | 🔴 **Yes** | `newArchEnabled=false` is unsupported on RN 0.82+ and produces a half-configured build. **Do not copy the `MAPS_API_KEY` line** — nothing reads it and it duplicates a secret into VCS |
| `android/settings.gradle` | `rootProject.name = 'iiGrain'`; RN plugin included build | No | **Yes** | No | 🟢 | Fresh template is identical except the project name — set that one line |
| `android/gradle/wrapper/gradle-wrapper.properties` | Gradle 9.3.1 | **Yes** | No | No | 🟠 | Toolchain drift can break the AGP/Kotlin/RN-plugin combination |
| `android/gradle/wrapper/gradle-wrapper.jar` | Wrapper bootstrap | No | **Yes** | No | 🟢 | Shipped with the fresh template |
| `android/gradlew`, `android/gradlew.bat` | Wrapper scripts | No | **Yes** | No | 🟢 | Shipped with the fresh template |
| `android/local.properties` | `sdk.dir=C:\Users\Home\AppData\Local\Android\Sdk` | **No** | **Yes** | No | 🟢 | **Machine-specific and gitignored.** Regenerated per machine by Android Studio/Gradle |
| `android/link-assets-manifest.json` | SHA-1 bookkeeping for the four Inter fonts | No | **Yes** | No | 🟢 | Regenerated by `npx react-native-asset` — hand-copying risks inconsistency with the actual files |

---

## 3. Android — manifest, source, keystore

| File Path | Purpose | Must Copy? | Must Recreate? | Optional? | Critical? | Reason |
|---|---|---|---|---|---|---|
| `android/app/src/main/AndroidManifest.xml` | 8 permissions, camera feature, Maps key + gms.version meta-data, `<application>` attrs, MainActivity config, MAIN/LAUNCHER filter | **Yes** | No | No | 🔴 **Yes** | Permissions form the Play Store permission list; the Maps meta-data must sit **inside `<application>`** or every map is a grey grid; portrait lock and `allowBackup=false` are shipped behaviour |
| `android/app/src/main/java/com/iigrain/MainApplication.kt` | **IPv4-preferred OkHttp DNS factory** + standard RN host | **Merge** | No | No | 🔴 **Yes** | The IPv4 DNS override prevents bogus "Network Error" failures on IPv6-advertising-but-unroutable networks and emulators. **The most easily-lost Android customisation** — a fresh template has none of it |
| `android/app/src/main/java/com/iigrain/MainActivity.kt` | `installSplashScreen()` first, `setDecorFitsSystemWindows(false)`, `super.onCreate(null)`, component name `iiGrain` | **Merge** | No | No | 🔴 **Yes** | Three separate load-bearing modifications: no splash / invisible status bar / RNScreens fragment crash if any is dropped |
| `android/app/debug.keystore` | Standard AOSP debug keystore (`androiddebugkey`) | **Yes** | Optional | Yes | 🟢 | Copy for a **stable debug SHA-1**, which matters if debug builds must render maps (the key is SHA-1-restricted). Not a store identity |
| `android/app/proguard-rules.pro` | ProGuard rules | No | **Yes** | Yes | 🟢 | **Comments only, zero rules.** Nothing to carry; `minifyEnabled` is `false` anyway |

---

## 4. Android — resources

| File Path | Purpose | Must Copy? | Must Recreate? | Optional? | Critical? | Reason |
|---|---|---|---|---|---|---|
| `android/app/src/main/res/values/strings.xml` | `app_name` = `iiGrain` | **Yes** | No | No | 🔴 **Yes** | The launcher label users see |
| `android/app/src/main/res/values/styles.xml` | `AppTheme` (white bg, force-light, green status bar) + `Theme.App.SplashScreen` | **Yes** | No | No | 🔴 **Yes** | Both themes are referenced from the manifest. Missing `Theme.App.SplashScreen` = build failure; missing `AppTheme` items = visible regressions |
| `android/app/src/main/res/values/colors.xml` | `ic_launcher_background` `#FFFFFF`, `splash_background` `#FFFFFF` | **Yes** | No | No | 🟠 | Referenced by the adaptive icon XML and the splash theme; missing = build failure |
| `android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml` | Adaptive icon definition | **Yes** | No | No | 🔴 **Yes** | Without it, API 26+ devices show the legacy raster icon instead of the adaptive one |
| `android/app/src/main/res/mipmap-anydpi-v26/ic_launcher_round.xml` | Adaptive round icon (byte-identical to the above) | **Yes** | No | No | 🔴 **Yes** | Same |
| `android/app/src/main/res/mipmap-{m,h,x,xx,xxx}hdpi/ic_launcher.png` (5) | Legacy launcher icon, 48–192 px | **Yes** | No | No | 🔴 **Yes** | Otherwise the RN default icon ships to the Play Store |
| `android/app/src/main/res/mipmap-{m,h,x,xx,xxx}hdpi/ic_launcher_round.png` (5) | Round launcher icon, 48–192 px | **Yes** | No | No | 🔴 **Yes** | Referenced by `android:roundIcon` |
| `android/app/src/main/res/mipmap-{m,h,x,xx,xxx}hdpi/ic_launcher_foreground.png` (5) | Adaptive foreground, 108–432 px | **Yes** | No | No | 🔴 **Yes** | The leaf mark for the adaptive icon |
| `android/app/src/main/res/drawable-{m,h,x,xx,xxx}hdpi/splash_icon.png` (5) | Native splash leaf, 288–1152 px | **Yes** | Regenerable | No | 🟠 | Referenced by `Theme.App.SplashScreen`. Regenerable via `scripts/gen_splash_assets.py` |
| `android/app/src/main/res/drawable/rn_edit_text_material.xml` | RN template EditText background | No | **Yes** | No | 🟢 | Ships with the fresh template; referenced by `AppTheme` |
| `android/app/src/main/res/raw/keep.xml` | `tools:keep` list for JS-only-referenced drawables | **No** | **Yes** | No | 🟢 | **Bundler-generated.** Regenerates on the first release build. Copying it stale risks references to drawables that no longer exist |
| `android/app/src/main/res/drawable-mdpi/src_assets_images_*.png` (6) | Bundler output from `require()`d JS images | **No** | **Yes** | No | 🟢 | Regenerated by the RN bundler from `src/` |
| `android/app/src/main/res/drawable-*/node_modules_reactnavigation_*.png` (17) | Bundler output from `@react-navigation` assets | **No** | **Yes** | No | 🟢 | Regenerated by the RN bundler from the installed `@react-navigation/*` versions |

---

## 5. Android — assets

| File Path | Purpose | Must Copy? | Must Recreate? | Optional? | Critical? | Reason |
|---|---|---|---|---|---|---|
| `android/app/src/main/assets/fonts/Inter-Regular.ttf` | Inter Regular | Via tooling | **Yes** | No | 🟠 | Run `npx react-native-asset`; Android resolves by **filename** |
| `android/app/src/main/assets/fonts/Inter-Medium.ttf` | Inter Medium | Via tooling | **Yes** | No | 🟠 | Same |
| `android/app/src/main/assets/fonts/Inter-SemiBold.ttf` | Inter SemiBold | Via tooling | **Yes** | No | 🟠 | Same |
| `android/app/src/main/assets/fonts/Inter-Bold.ttf` | Inter Bold | Via tooling | **Yes** | No | 🟠 | Same |
| `android/app/src/main/assets/index.android.bundle` | **Stale committed JS bundle** | 🔴 **NO — DO NOT COPY** | **Yes** (build output) | No | 🔴 **Yes** | A committed bundle in `assets/` **shadows the freshly built one**, shipping old JavaScript. It is build output that should never have been committed. Explicitly exclude it |

---

## 6. iOS — project and workspace

| File Path | Purpose | Must Copy? | Must Recreate? | Optional? | Critical? | Reason |
|---|---|---|---|---|---|---|
| `ios/iiGrain.xcodeproj/project.pbxproj` | Bundle ID, team, versions, deployment target, Swift version, icon name, sandboxing flag, linker flags, font references, 7 build phases | **Merge** | No | No | 🔴 **Yes** | Carries the entire App Store identity. **Do not copy wholesale** into a fresh project (UUIDs and pod references differ) — set the documented values in the new project's settings instead. See `03_IOS_CONFIGURATION.md` §14 |
| `ios/iiGrain.xcodeproj/xcshareddata/xcschemes/iiGrain.xcscheme` | Shared scheme; Archive → Release; `allowLocationSimulation` | **Merge** | No | No | 🟠 | Must be **shared** or CI reports "scheme not found". Drop the dangling `iiGrainTests` `<Testables>` reference — that target does not exist |
| `ios/iiGrain.xcodeproj/xcshareddata/xcschemes/iiGrain 1.xcscheme` | Duplicate scheme from an Xcode upgrade prompt | 🔴 **NO** | No | Yes | 🟢 | Artefact, not configuration. **Do not recreate** — two schemes for one target invites the wrong one being archived |
| `ios/iiGrain.xcworkspace/contents.xcworkspacedata` | Workspace linking the project + Pods | No | **Yes** | No | 🟢 | Regenerated by `pod install` |

---

## 7. iOS — source, Podfile, environment

| File Path | Purpose | Must Copy? | Must Recreate? | Optional? | Critical? | Reason |
|---|---|---|---|---|---|---|
| `ios/Podfile` | `RCT_USE_PREBUILT_RNCORE='0'`, `react-native-maps/Google` subspec, Maps-key xcconfig generation + `post_install` include injection | **Merge** | No | No | 🔴 **Yes** | **The highest-risk iOS file.** Missing `RCT_USE_PREBUILT_RNCORE=0` → Debug simulator link failure. Missing the `/Google` subspec → **silent** Apple-Maps fallback. Missing the xcconfig hook → blank maps |
| `ios/iiGrain/AppDelegate.swift` | `import GoogleMaps`, `configureGoogleMaps()` called first, module name `iiGrain` | **Merge** | No | No | 🔴 **Yes** | The Maps SDK is a process-wide singleton with no retry — if it is unkeyed when the first `GMSMapView` is created, every map stays blank for the whole session |
| `ios/iiGrain/Info.plist` | 6 usage descriptions, ATS, `ITSAppUsesNonExemptEncryption`, `GMSApiKey`, `UIAppFonts`, orientation, light mode, new arch | **Yes** | No | No | 🔴 **Yes** | Missing usage descriptions **hard-crash** the app; missing `ITSAppUsesNonExemptEncryption` stalls every TestFlight upload |
| `ios/iiGrain/PrivacyInfo.xcprivacy` | Apple required-reason API manifest (3 categories) | **Yes** | No | No | 🔴 **Yes** | Omitting or altering it triggers `ITMS-91053: Missing API declaration` on upload. Must be in the Resources build phase |
| `ios/iiGrain/LaunchScreen.storyboard` | White bg, centred 160 pt aspect-fit `LeafLogo` | **Yes** | No | No | 🟠 | Referenced by `UILaunchStoryboardName`. The 160 pt constraint is calibrated to Android's 67 dp leaf — do not alter |
| `ios/.xcode.env` | `export NODE_BINARY=$(command -v node)` | **Yes** | No | No | 🟠 | An `inputPath` of the RN bundle script phase; generic and portable |
| `ios/.xcode.env.local` | `export NODE_BINARY=/opt/homebrew/Cellar/node/25.6.1/bin/node` | 🔴 **NO** | Per machine | Yes | 🟢 | **Hardcodes one developer's Homebrew node path.** Gitignored. Copying it breaks every other machine |
| `ios/Podfile.lock` | Resolved pod versions | **Reference only** | **Yes** | No | 🟡 | Currently **gitignored**, so versions are not pinned across machines. Use it as the reference to verify against, and consider **committing** it in the new project (an improvement, not identity) |
| `ios/link-assets-manifest.json` | SHA-1 bookkeeping for the four Inter fonts | No | **Yes** | No | 🟢 | Regenerated by `npx react-native-asset` |
| `ios/Config/Env.generated.xcconfig` | Generated `MAPS_API_KEY` build setting | **No** | **Yes** | No | 🔴 **Yes** (mechanism) | **Gitignored by design** — carries the secret. Written by `ios/Podfile` on every `pod install`. Does not currently exist in this tree (no `pod install` has run on this Windows machine) |
| `ios/.DS_Store` | macOS Finder metadata | **No** | No | Yes | 🟢 | Noise |

---

## 8. iOS — assets

| File Path | Purpose | Must Copy? | Must Recreate? | Optional? | Critical? | Reason |
|---|---|---|---|---|---|---|
| `ios/iiGrain/Images.xcassets/Contents.json` | Root asset-catalogue metadata | **Yes** | No | No | 🟢 | Trivial but required for a valid catalogue |
| `ios/iiGrain/Images.xcassets/AppIcon.appiconset/Contents.json` | Maps 21 filenames → idiom/size/scale (IconKitchen-generated) | **Yes** | No | No | 🔴 **Yes** | Regenerating with a different tool produces different filenames and a different mapping |
| `ios/iiGrain/Images.xcassets/AppIcon.appiconset/*.png` (21 files) | The app icon — **this is the icon the current TestFlight build uses** | **Yes** | No | No | 🔴 **Yes** | Includes `AppIcon~ios-marketing.png` (1024×1024), which App Store Connect and TestFlight display. An incomplete set fails validation or shows a blank tile to every tester |
| `ios/iiGrain/Images.xcassets/LeafLogo.imageset/Contents.json` | `template-rendering-intent: original` | **Yes** | No | No | 🟠 | Without `original`, the green leaf renders as a flat tint silhouette on the launch screen |
| `ios/iiGrain/Images.xcassets/LeafLogo.imageset/leaf.png` | 432 × 432 launch-screen leaf | **Yes** | Regenerable | No | 🟠 | The storyboard alone gives a blank white launch screen. Regenerable via `scripts/gen_splash_assets.py` |
| `src/assets/fonts/Inter-*.ttf` (4, referenced from `ios/`) | Inter font family — referenced by `PBXFileReference` at `../src/assets/fonts/` | Via tooling | **Yes** | No | 🟠 | **iOS resolves by PostScript name** (`Inter18pt-*`), Android by filename. Substituting a different Inter cut silently breaks iOS typography while Android stays fine. Use `npx react-native-asset` |

---

## 9. Generated / build output — never copy

| Path | Why not |
|---|---|
| `android/build/`, `android/app/build/` | Gradle build output |
| `android/.gradle/`, `android/.idea/`, `**/.cxx/` | Tool caches |
| `android/app/src/main/assets/index.android.bundle` | 🔴 Stale JS bundle — **shadows the real build output** |
| `android/app/src/main/res/raw/keep.xml` | Bundler-generated |
| `android/app/src/main/res/drawable-*/src_assets_*`, `…/node_modules_*` | Bundler-generated |
| `android/local.properties` | Machine-specific SDK path |
| `ios/Pods/`, `ios/build/` | CocoaPods / Xcode output |
| `ios/*.xcodeproj/xcuserdata/`, `ios/*.xcworkspace/xcuserdata/` | Per-user Xcode state (includes unshared schemes) |
| `ios/Config/Env.generated.xcconfig` | Generated per `pod install`; carries the Maps secret |
| `ios/.xcode.env.local` | Machine-specific node path |
| `ios/.DS_Store` | macOS noise |
| `node_modules/` | `npm install` output |

---

## 10. Files that do NOT exist — confirmed by exhaustive search

Documented so a future engineer does not go looking, or "helpfully" add them.

| Expected file | Status | Implication |
|---|---|---|
| `android/app/google-services.json` | ❌ Absent | **No Firebase on Android.** Do not add — it would change behaviour, not preserve it |
| `ios/iiGrain/GoogleService-Info.plist` | ❌ Absent | **No Firebase on iOS.** Do not add |
| `ios/iiGrain/iiGrain.entitlements` | ❌ Absent | **No capabilities at all** — no push, no keychain sharing, no associated domains. The correct migrated project also has none |
| `*.mobileprovision` | ❌ Absent | Signing is `Automatic`; Xcode manages profiles server-side |
| `android/app/src/main/res/xml/network_security_config.xml` | ❌ Absent | Cleartext is governed only by the `usesCleartextTraffic` placeholder |
| `android/keystore.properties` / `*.keystore.properties` | ❌ Absent | Release signing credentials exist **nowhere** in the repo |
| `signingConfigs { release { … } }` in `app/build.gradle` | ❌ Absent | 🔴 Release is wired to the **debug** keystore — see `04_PLAY_STORE_READY.md` §2 |
| Android notification icon (`ic_notification` / `ic_stat_*`) | ❌ Absent | Falls back to `@mipmap/ic_launcher` (renders as a white silhouette). Current shipped behaviour |
| Adaptive `<monochrome>` layer | ❌ Absent | No themed-icon support on Android 13+. Current shipped behaviour |
| `iiGrainTests/` target and directory | ❌ Absent | The scheme references it anyway — a dangling reference to drop |
| Deep links (`<data android:scheme>`, `CFBundleURLTypes`) | ❌ Absent | No deep linking on either platform. Add none |
| `UIBackgroundModes` | ❌ Absent | No background execution on iOS |
| `assetlinks.json` / `apple-app-site-association` | ❌ Absent | No App Links / Universal Links |
| CI configuration (`.github/workflows`, `fastlane/`, `ExportOptions.plist`) | ❌ Absent | Builds are produced manually; there is no pipeline to migrate |
| `patches/*.patch` | ❌ Absent (dir is empty) | No `patch-package` patches, despite the `postinstall` script |

---

## 11. Summary counts

| Category | Count |
|---|---|
| Android hand-authored config files | 13 |
| Android hand-authored resource files (icons + splash) | 22 |
| Android font assets | 4 |
| Android generated files to skip | 24+ |
| iOS hand-authored config files | 9 |
| iOS asset files (icons + launch) | 25 |
| Root-level files driving native config | 8 |
| **Files marked 🔴 Critical** | **31** |
| **Files that must NOT be copied** | **5** (`index.android.bundle`, `.xcode.env.local`, `iiGrain 1.xcscheme`, `local.properties`, `.DS_Store`) plus all generated output |

---

## 12. The five "do not copy" files, restated

These are easy to sweep up in a bulk copy and each causes a real problem:

| File | What goes wrong |
|---|---|
| `android/app/src/main/assets/index.android.bundle` | 🔴 Ships stale JavaScript — shadows the freshly built bundle |
| `ios/.xcode.env.local` | 🔴 Hardcoded Homebrew node path breaks the build on every other machine |
| `ios/iiGrain.xcodeproj/xcshareddata/xcschemes/iiGrain 1.xcscheme` | 🟢 Duplicate scheme; risks archiving the wrong one |
| `android/local.properties` | 🟢 Machine-specific SDK path |
| `ios/.DS_Store` | 🟢 macOS noise |

---

## Cross-references

* Identity values → `01_PROJECT_IDENTITY.md`
* Android detail → `02_ANDROID_CONFIGURATION.md`
* iOS detail → `03_IOS_CONFIGURATION.md`
* Play Store lock-list → `04_PLAY_STORE_READY.md`
* TestFlight lock-list → `05_TESTFLIGHT_READY.md`
* Icon inventory with measured dimensions → `06_APP_ICONS.md`
* Ordered execution plan → `07_MIGRATION_CHECKLIST.md`
