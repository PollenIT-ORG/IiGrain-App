# 05 — TestFlight Ready (iOS Identity Lock-List)

> Every iOS value that **must remain byte-identical** after migration so the existing App Store
> Connect record keeps accepting builds, and so current TestFlight testers receive the migrated
> build as an **update** rather than a new app.
>
> Rule of thumb: App Store Connect identifies an app by **Bundle Identifier**, and trusts a build
> based on **Team + signing + entitlements**. The good news for this project: iOS signing is fully
> automatic and there is no entitlements file, so there is very little to get wrong — provided you
> change nothing.

---

## 0. The four things that actually decide success

| # | Value | Consequence of change |
|---|---|---|
| 1 | **Bundle Identifier** `com.amitbaser.iigrain` | A different ID creates a **new App Store record**. The existing app, its TestFlight groups and its testers are stranded. |
| 2 | **Development Team** `SADMK33W84` | Wrong team → cannot sign for this bundle ID at all; upload rejected. |
| 3 | **`CURRENT_PROJECT_VERSION` ≥ 10** | Build `9` is already consumed; App Store Connect rejects a duplicate build number for the same version. |
| 4 | **`ITSAppUsesNonExemptEncryption = false`** | Every upload stalls awaiting a manual export-compliance answer instead of reaching testers. |

Items 1 and 2 are unrecoverable. Items 3 and 4 block the pipeline but are trivially fixable.

---

## 1. Bundle Identifier — 🔴 MUST NOT CHANGE

| Field | Required value |
|---|---|
| `PRODUCT_BUNDLE_IDENTIFIER` (Debug) | `com.amitbaser.iigrain` |
| `PRODUCT_BUNDLE_IDENTIFIER` (Release) | `com.amitbaser.iigrain` |
| `Info.plist` → `CFBundleIdentifier` | `$(PRODUCT_BUNDLE_IDENTIFIER)` — keep as the **variable**, never a literal |

Set in **both** build configurations. Verify:

```bash
# In the built .app — must print com.amitbaser.iigrain
/usr/libexec/PlistBuddy -c "Print :CFBundleIdentifier" \
  build/Release-iphoneos/iiGrain.app/Info.plist
```

> ⚠️ The iOS bundle ID **intentionally differs** from the Android application ID (`com.iigrain`).
> Do not "fix" the inconsistency. Both are shipped identities.

---

## 2. Apple Team — 🔴 MUST NOT CHANGE

| Field | Value | Where |
|---|---|---|
| `DEVELOPMENT_TEAM` | `SADMK33W84` | Target build settings, **Debug and Release** |

The human-readable team name is not stored in the project — read it from the Apple Developer portal
if you need it for documentation.

> 🔴 **This value has a second, non-obvious job:** it forms the prefix of the app's implicit keychain
> access group (`$(AppIdentifierPrefix)com.amitbaser.iigrain`). Change the team and every existing
> install loses access to its stored keychain items — **testers are silently signed out on update.**
> See §7.

---

## 3. Signing — automatic, low risk

| Setting | Value | Level |
|---|---|---|
| `CODE_SIGN_STYLE` | `Automatic` | Target, both configs |
| `DEVELOPMENT_TEAM` | `SADMK33W84` | Target, both configs |
| `CODE_SIGN_IDENTITY[sdk=iphoneos*]` | `iPhone Developer` | Project, both configs |
| `CODE_SIGN_ENTITLEMENTS` | ❌ **absent — keep it absent** | — |

**Migration action:** in the fresh project set *Automatically manage signing* ✅ and the team to
`SADMK33W84`. Xcode then creates/downloads the profile for `com.amitbaser.iigrain` itself.

**Do not** switch to manual signing "to be safe" — that requires managing profiles that do not exist
in this repository and introduces a failure mode the current project does not have.

---

## 4. Provisioning — nothing to copy

| Artefact | Status |
|---|---|
| `PROVISIONING_PROFILE` / `PROVISIONING_PROFILE_SPECIFIER` | ❌ Not set anywhere in `project.pbxproj` |
| `*.mobileprovision` file | ❌ Not present anywhere in the repository |
| `ExportOptions.plist` | ❌ Not present |
| Fastlane / match configuration | ❌ Not present |

Because signing is automatic, **there is no provisioning artefact to migrate**. Xcode regenerates
everything from `DEVELOPMENT_TEAM` + `PRODUCT_BUNDLE_IDENTIFIER`.

Requirements on the build machine: signed in to Xcode with an account on team `SADMK33W84` holding
at least the *App Manager*/*Developer* role.

---

## 5. Capabilities — 🔴 ADD NOTHING

**The app currently has zero capabilities and no entitlements file.** This is verified, not assumed:
an exhaustive search found no `*.entitlements` file and no `CODE_SIGN_ENTITLEMENTS` build setting.

| Capability | Current | Migration action |
|---|---|---|
| Push Notifications | ❌ Not enabled | **Do not enable** |
| Background Modes | ❌ None (`UIBackgroundModes` key absent) | **Do not add** |
| Keychain Sharing | ❌ No `keychain-access-groups` | **Do not add** — see §7 |
| Associated Domains | ❌ None | **Do not add** |
| App Groups | ❌ None | **Do not add** |
| Sign in with Apple | ❌ None | **Do not add** |
| iCloud / CloudKit | ❌ None | **Do not add** |
| HealthKit / HomeKit / NFC / Wallet | ❌ None | **Do not add** |
| In-App Purchase | ❌ None | **Do not add** |

> 🔴 **The most likely accidental break in the whole iOS migration:** clicking a capability in
> Xcode's *Signing & Capabilities* tab. A single click creates an `iiGrain.entitlements` file, sets
> `CODE_SIGN_ENTITLEMENTS`, changes the provisioning profile, and changes the signed entitlements of
> the binary. That can fail App Store validation (`ITMS-90164`/`ITMS-90046` style entitlement
> mismatches) or, worse, upload successfully with entitlements the App Store record was not
> configured for.
>
> **The correct migrated project has no entitlements file at all.**

### Verification

```bash
# Must show NO aps-environment, NO keychain-access-groups,
# only the automatic get-task-allow / application-identifier / team-identifier
codesign -d --entitlements :- build/Release-iphoneos/iiGrain.app
```

---

## 6. Push Notifications — 🔴 NOT CONFIGURED; KEEP IT THAT WAY

| Evidence | Finding |
|---|---|
| `aps-environment` entitlement | ❌ absent (no entitlements file exists) |
| `UIBackgroundModes → remote-notification` | ❌ absent (no `UIBackgroundModes` key) |
| `UNUserNotificationCenter` / `registerForRemoteNotifications` in `AppDelegate.swift` | ❌ absent |
| `didRegisterForRemoteNotificationsWithDeviceToken` | ❌ absent |
| Firebase Messaging pod | ❌ absent |
| APNs key / certificate reference | ❌ none in the repository |

`@notifee/react-native` **is** installed, but with no APNs entitlement it provides **local and
scheduled notifications only** on iOS. Notification behaviour is driven entirely from JavaScript.

**Migration action:** install `@notifee/react-native` at the same version, add **no** entitlement, add
**no** `UIBackgroundModes`, and write **no** push registration code. Adding push would change the
provisioning profile and the app's declared capabilities relative to the live App Store record.

---

## 7. Keychain — 🔴 SILENT LOGOUT RISK

| Aspect | Value |
|---|---|
| Library | `react-native-keychain` 10.0.0 → pod `RNKeychain (10.0.0)` |
| Entitlement | ❌ none |
| Access group | **Implicit default** — `$(AppIdentifierPrefix)com.amitbaser.iigrain` |
| `NSFaceIDUsageDescription` | ❌ absent |

The implicit access group is derived from **team prefix + bundle identifier**. Both must stay
unchanged for existing keychain items to remain readable.

| If you change… | Result |
|---|---|
| Bundle ID | 🔴 Keychain items unreachable → **every tester silently logged out on update** |
| `DEVELOPMENT_TEAM` | 🔴 Same — the app identifier prefix changes |
| Add `keychain-access-groups` | 🟠 Changes group resolution order; can strand existing items |

**Migration action:** keep both values, add no keychain entitlement, and **explicitly test session
persistence across the update** (see §14 — install the old build, sign in, then install the migrated
build over it and confirm you are still signed in). This is the single best end-to-end proof that
iOS identity was preserved.

> Do **not** add `NSFaceIDUsageDescription` "for completeness". It is absent today and the app does
> not prompt for Face ID; adding it changes nothing functionally, and omitting it matches current
> behaviour exactly.

---

## 8. Google Maps — 🔴 TWO SILENT FAILURE MODES

### 8.1 The key-delivery chain must be reproduced end to end

```
application/.env (or $MAPS_API_KEY)
  → ios/Podfile: resolve_maps_api_key + write_maps_xcconfig  (at `pod install`)
  → ios/Config/Env.generated.xcconfig     [GENERATED, GITIGNORED]
  → #include? appended to Pods-iiGrain.{debug,release}.xcconfig (post_install hook)
  → $(MAPS_API_KEY) build setting
  → Info.plist → GMSApiKey
  → AppDelegate.configureGoogleMaps() → GMSServices.provideAPIKey()
```

Every hop is required. Miss any and `GMSApiKey` resolves to empty → the app **still launches, still
builds, logs one `NSLog` warning**, and every map in the session is blank.

Required pieces:

- [ ] `Info.plist` contains `<key>GMSApiKey</key><string>$(MAPS_API_KEY)</string>`
- [ ] `Podfile` contains `resolve_maps_api_key`, `write_maps_xcconfig`, and the `post_install`
      xcconfig-include injection over `installer.aggregate_targets`
- [ ] `AppDelegate.swift` calls `configureGoogleMaps()` as the **first statement** of
      `didFinishLaunchingWithOptions` (the SDK is a process-wide singleton with **no retry** — if it
      is unkeyed when the first `GMSMapView` is created, every map stays blank for the whole session)
- [ ] `.env` (or `$MAPS_API_KEY`) present on the build machine at `pod install` time
- [ ] `ios/Config/Env.generated.xcconfig` is **gitignored** in the new project

### 8.2 🔴 The `/Google` subspec fails silently

```ruby
pod 'react-native-maps/Google', :path => '../node_modules/react-native-maps'
```

Declared **before** `use_react_native!`. Google Maps on iOS is opt-in: the default `Maps` subspec
compiles Apple MapKit only, the podspec then defines `HAVE_GOOGLE_MAPS=0`, and `provider="google"`
**silently falls back to Apple Maps.**

> **This is the nastiest silent regression in the iOS migration.** Miss the line and maps still
> appear — as Apple Maps, ignoring the custom JSON map style, diverging from Android. It passes a
> casual smoke test.

Verification: `import GoogleMaps` in `AppDelegate.swift` must compile. The file's own comment states
that a failure of that import **is the intended signal** that iOS fell back to MapKit. Then visually
confirm Google tiles + the custom style, and that iOS matches Android.

- [ ] `GoogleMaps` and `Google-Maps-iOS-Utils` appear in the new `Podfile.lock`
- [ ] `import GoogleMaps` compiles
- [ ] Map tiles are Google's and honour the custom style

### 8.3 Key restrictions

Google Maps **iOS** keys are restricted by **bundle identifier** (not by certificate fingerprint as
on Android). Keeping `com.amitbaser.iigrain` keeps the restriction satisfied.

- [ ] Confirm in Google Cloud Console that the iOS key's application restriction lists
      `com.amitbaser.iigrain`
- [ ] Note whether Android and iOS share one key or use separate keys (the Android key is restricted
      by package + SHA-1 — see `04_PLAY_STORE_READY.md` §4)

---

## 9. Firebase — nothing to preserve

| Checked | Result |
|---|---|
| `GoogleService-Info.plist` | ❌ absent from the entire repository |
| `Firebase*` pods | ❌ none in `Podfile.lock` |
| `FirebaseApp.configure()` / `import Firebase` | ❌ absent from `AppDelegate.swift` |
| `@react-native-firebase/*` | ❌ not in `package.json` |

**Action: add nothing.** Adding a `GoogleService-Info.plist` would change behaviour, not preserve it.

> Naming trap: `GoogleMaps` and `Google-Maps-iOS-Utils` **are** present. Those are the Maps Platform
> SDK, unrelated to Firebase.

---

## 10. App Icon — the icon TestFlight currently shows

**The icon in the current TestFlight build is `AppIcon.appiconset` inside
`ios/iiGrain/Images.xcassets`**, selected by `ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon`.

| Property | Value |
|---|---|
| Asset set | `ios/iiGrain/Images.xcassets/AppIcon.appiconset` |
| File count | **21 PNGs** + `Contents.json` |
| Generator | **IconKitchen** (`Contents.json` → `"author": "iconkitchen"`) |
| Idioms | `iphone`, `ipad`, `car` (CarPlay), `ios-marketing` |
| Marketing icon | `AppIcon~ios-marketing.png` at **1024 × 1024**, inside the appiconset |
| Alternate icons | ❌ none (`CFBundleIcons` / `CFBundleAlternateIcons` absent) |
| Dark / tinted variants | ❌ none (iOS 18 appearance variants not configured) |

> 🔴 The **1024 × 1024 marketing icon is inside the asset catalogue**. It is what App Store Connect
> and the TestFlight app list display. If the appiconset is not copied completely, the upload either
> fails validation with a missing-icon error or TestFlight shows a blank/default icon to every
> tester — highly visible.

**Migration action:** copy the entire `AppIcon.appiconset` directory, `Contents.json` included. Do
not regenerate it — regenerating with a different tool changes filenames and the `Contents.json`
mapping. Full inventory in `06_APP_ICONS.md`.

---

## 11. Launch Screen

| Property | Value |
|---|---|
| File | `ios/iiGrain/LaunchScreen.storyboard` |
| `Info.plist` key | `UILaunchStoryboardName = LaunchScreen` |
| Build phase | Member of `PBXResourcesBuildPhase` |
| Background | `#FFFFFF` |
| Content | One centred `UIImageView`, **160 × 160 pt**, `scaleAspectFit` |
| Image | `LeafLogo` → `leaf.png`, **432 × 432**, `template-rendering-intent: original` |
| On-screen leaf size | **67 pt** — calibrated to match Android exactly |
| Launch images / `.launchimage` | ❌ none — the storyboard is the only launch mechanism |

**Both** the storyboard **and** the `LeafLogo.imageset` must be copied — the storyboard alone
produces a blank white launch screen.

> Do not alter the 160 pt constraints or regenerate `leaf.png` by hand. The 432 px canvas → 160 pt
> view → 67 pt on-screen leaf is one calibrated system shared with Android via
> `scripts/gen_splash_assets.py`. To rebrand, replace `branding/splash_master.png` and re-run the
> generator.

---

## 12. Display Name, Target, Scheme

| Field | Required value | Notes |
|---|---|---|
| **Display Name** | `iiGrain` | `Info.plist` → `CFBundleDisplayName`, a **literal string** (not `$(PRODUCT_NAME)`) — this is the name under the home-screen icon |
| **Bundle Name** | `$(PRODUCT_NAME)` → `iiGrain` | `CFBundleName` |
| **Target** | `iiGrain` | Single target; `productType = com.apple.product-type.application` |
| **Product Name** | `iiGrain` | `PRODUCT_NAME`, both configs |
| **Product** | `iiGrain.app` | |
| **Scheme** | `iiGrain` | **Shared** (must live in `xcshareddata/xcschemes/`), `ArchiveAction` on `Release` |
| **Xcode project** | `iiGrain.xcodeproj` | |
| **Workspace** | `iiGrain.xcworkspace` | Regenerated by `pod install` |
| **JS module name** | `iiGrain` | `AppDelegate.swift` → `startReactNative(withModuleName: "iiGrain", …)` — must match `AppRegistry.registerComponent` |

**Do not recreate:**
* `iiGrain 1.xcscheme` — a duplicate left by an Xcode upgrade prompt
* the `iiGrainTests` `<Testables>` reference in `iiGrain.xcscheme` — the target does not exist

> The scheme **must be shared**. An unshared scheme lives in `xcuserdata` (gitignored) and CI
> reports *"scheme iiGrain not found"*.

---

## 13. `Info.plist` values that must be preserved

### 🔴 Critical — break the TestFlight pipeline or crash the app

| Key | Value | Why critical |
|---|---|---|
| `ITSAppUsesNonExemptEncryption` | `false` | **Skips the export-compliance questionnaire.** Omit it and every upload stalls awaiting manual answers before testers can install. |
| `CFBundleIdentifier` | `$(PRODUCT_BUNDLE_IDENTIFIER)` | App Store Connect identity |
| `CFBundleShortVersionString` | `$(MARKETING_VERSION)` → `2.0` | Version shown in TestFlight |
| `CFBundleVersion` | `$(CURRENT_PROJECT_VERSION)` → next ≥ `10` | Build number; duplicates rejected |
| `CFBundleDisplayName` | `iiGrain` | Home-screen name |
| `NSCameraUsageDescription` | *(exact string — §13.1)* | **iOS hard-crashes** on camera access without it |
| `NSMicrophoneUsageDescription` | *(exact string)* | Hard-crash on audio capture |
| `NSPhotoLibraryUsageDescription` | *(exact string)* | Hard-crash on library access |
| `NSPhotoLibraryAddUsageDescription` | *(exact string)* | Hard-crash on save-to-library |
| `NSLocationWhenInUseUsageDescription` | *(exact string)* | Location silently denied / crash |
| `NSLocationAlwaysAndWhenInUseUsageDescription` | *(exact string)* | idem |
| `GMSApiKey` | `$(MAPS_API_KEY)` | Blank maps if missing |
| `UILaunchStoryboardName` | `LaunchScreen` | No launch screen |
| `UIAppFonts` | 5 entries | Fonts silently fall back to system |

### 13.1 The six usage-description strings — copy verbatim

These are user-visible **and** App-Review-visible. Reviewers compare them against actual behaviour;
vague replacements are a documented rejection cause.

| Key | Exact string |
|---|---|
| `NSCameraUsageDescription` | `iiGrain needs camera access so you can take photos and record videos for your farms, fields and assessments.` |
| `NSMicrophoneUsageDescription` | `iiGrain needs microphone access so recorded assessment videos include sound.` |
| `NSPhotoLibraryUsageDescription` | `iiGrain needs photo and video library access so you can attach media to your farms, fields and assessments.` |
| `NSPhotoLibraryAddUsageDescription` | `iiGrain needs permission to save photos to your library.` |
| `NSLocationWhenInUseUsageDescription` | `iiGrain needs your location so you can pin farms and fields on the map and record where assessments were carried out.` |
| `NSLocationAlwaysAndWhenInUseUsageDescription` | `iiGrain needs your location so you can pin farms and fields on the map and record where assessments were carried out.` |

### 🟠 Important — visible behaviour changes

| Key | Value | Effect if changed |
|---|---|---|
| `NSAppTransportSecurity` → `NSAllowsArbitraryLoads` | `false` | Weakening ATS is a security regression and can draw review attention |
| `NSAppTransportSecurity` → `NSAllowsLocalNetworking` | `true` | Local/LAN dev backends and Metro stop working |
| `UISupportedInterfaceOrientations` | Portrait only | The app would start rotating on iPhone |
| `UISupportedInterfaceOrientations~ipad` | All four | iPad rotation behaviour changes |
| `UIUserInterfaceStyle` | `Light` | The app would start following system dark mode |
| `UIViewControllerBasedStatusBarAppearance` | `false` | JS loses app-wide status-bar control |
| `RCTNewArchEnabled` | `true` | Must match Android's `newArchEnabled=true` |
| `CADisableMinimumFrameDurationOnPhone` | `true` | Loses ProMotion / >60 Hz rendering |
| `UIRequiredDeviceCapabilities` | `arm64` | Changes device eligibility |
| `TARGETED_DEVICE_FAMILY` | `1,2` | Dropping `2` **removes iPad support from the App Store listing** |
| `IPHONEOS_DEPLOYMENT_TARGET` | `15.1` | Raising it drops existing users on older iOS from updates |

### 🔴 `PrivacyInfo.xcprivacy` — copy verbatim

A member of the Resources build phase. Omitting or altering it triggers `ITMS-91053: Missing API
declaration` warnings or rejection on upload.

| Key | Value |
|---|---|
| `NSPrivacyTracking` | `false` |
| `NSPrivacyCollectedDataTypes` | `[]` |
| `NSPrivacyAccessedAPITypes` | `FileTimestamp` (`C617.1`, `3B52.1`), `UserDefaults` (`CA92.1`), `SystemBootTime` (`35F9.1`) |

### Keys that must stay ABSENT

`UIBackgroundModes` · `CFBundleURLTypes` · `LSApplicationQueriesSchemes` · `NSUserActivityTypes` ·
`UIFileSharingEnabled` · `LSSupportsOpeningDocumentsInPlace` · `NSFaceIDUsageDescription` ·
`NSUserTrackingUsageDescription` · `CFBundleLocalizations`

---

## 14. Build settings that must be preserved

| Setting | Value | Why |
|---|---|---|
| `ENABLE_USER_SCRIPT_SANDBOXING` | `NO` | 🔴 The RN bundle script phase writes outside the sandbox; `YES` fails the archive |
| `OTHER_LDFLAGS` | `$(inherited)`, `-ObjC`, `-lc++` | 🔴 `-ObjC` is required for category loading in static libs |
| `SWIFT_VERSION` | `5.0` | 🟠 |
| `IPHONEOS_DEPLOYMENT_TARGET` | `15.1` | 🟠 Project **and** target level |
| `TARGETED_DEVICE_FAMILY` | `1,2` | 🟠 iPad support |
| `ASSETCATALOG_COMPILER_APPICON_NAME` | `AppIcon` | 🔴 Icon resolution |
| `USE_HERMES` | `true` | 🔴 JS engine parity with Android |
| `CLANG_CXX_LANGUAGE_STANDARD` | `c++20` | 🔴 RN 0.84 requirement |
| `OTHER_CFLAGS` / `OTHER_CPLUSPLUSFLAGS` | `-DRCT_REMOVE_LEGACY_ARCH=1` + the FOLLY defines | 🔴 New-arch build |
| `SWIFT_ENABLE_EXPLICIT_MODULES` | `NO` | 🟠 Known RN 0.84 build workaround |
| `EXCLUDED_ARCHS[sdk=iphonesimulator*]` | `""` | 🟠 |
| `VERSIONING_SYSTEM` | `apple-generic` | 🟢 |
| `LD_RUNPATH_SEARCH_PATHS` | `$(inherited)`, `@executable_path/Frameworks` (target); `/usr/lib/swift`, `$(inherited)` (project) | 🟠 |

### Podfile — 🔴 `RCT_USE_PREBUILT_RNCORE = '0'`

```ruby
ENV['RCT_USE_PREBUILT_RNCORE'] = '0'
```

Without it, Debug simulator builds die with *"Undefined symbols for architecture arm64"* because the
prebuilt Release `React.xcframework` has debug-only symbols compiled out while third-party Fabric
pods (RNScreens, RNSVG, RNGestureHandler, RNReanimated, RNDateTimePicker) still reference them.
Release device archives link fine — so **only local development breaks**, which makes it easy to lose
and expensive to re-diagnose. Full reasoning in `03_IOS_CONFIGURATION.md` §12.1.

### Build phase order — 7 phases, exactly this sequence

```
1. [CP] Check Pods Manifest.lock
2. Sources                            (AppDelegate.swift — the only source file)
3. Frameworks                         (libPods-iiGrain.a)
4. Resources                          (LaunchScreen, Images.xcassets, PrivacyInfo, 4× Inter .ttf)
5. Bundle React Native code and images
6. [CP] Embed Pods Frameworks
7. [CP] Copy Pods Resources
```

The RN bundle phase runs **after** `Resources` and **before** the CocoaPods embed/copy phases.

---

## 15. Fonts

| Aspect | Requirement |
|---|---|
| `UIAppFonts` | `MaterialCommunityIcons.ttf`, `Inter-Bold.ttf`, `Inter-Medium.ttf`, `Inter-Regular.ttf`, `Inter-SemiBold.ttf` |
| Resources phase | The four Inter `.ttf` files must be members |
| `PBXFileReference` paths | `../src/assets/fonts/Inter-*.ttf` (referenced from `src/`, not copied into `ios/`) |
| `MaterialCommunityIcons.ttf` | Delivered by the `RNVectorIcons` pod's resource bundle — **not** a project file reference |

> ⚠️ **iOS resolves fonts by PostScript name, not filename.** These four files are the Inter "18pt"
> cut, whose PostScript names are `Inter18pt-Regular` / `-Medium` / `-SemiBold` / `-Bold`, while
> Android resolves the same files by filename. Substituting a different Inter cut **silently breaks
> iOS typography while leaving Android correct**. Use the exact same `.ttf` files.

**Migration action:** run `npx react-native-asset` rather than hand-adding references, so the file
references, Resources membership, `UIAppFonts` array and `link-assets-manifest.json` stay consistent.

---

## 16. TestFlight pre-flight checklist

### Identity
- [ ] `CFBundleIdentifier` resolves to `com.amitbaser.iigrain` in the built `.app`
- [ ] `CFBundleDisplayName` = `iiGrain`
- [ ] `MARKETING_VERSION` = `2.0` (or a deliberate increase)
- [ ] `CURRENT_PROJECT_VERSION` ≥ `10`
- [ ] `PRODUCT_NAME` = `iiGrain`; product is `iiGrain.app`
- [ ] Scheme `iiGrain` exists and is **shared**; Archive → Release

### Signing & capabilities
- [ ] `DEVELOPMENT_TEAM` = `SADMK33W84`, both configs
- [ ] Automatic signing enabled
- [ ] **No `.entitlements` file exists in the project**
- [ ] `codesign -d --entitlements` shows no `aps-environment`, no `keychain-access-groups`
- [ ] No capability was enabled in Xcode's Signing & Capabilities tab

### Upload gates
- [ ] `ITSAppUsesNonExemptEncryption` = `false` — **build reaches testers without a compliance prompt**
- [ ] `PrivacyInfo.xcprivacy` present and in the Resources phase; no `ITMS-91053` warning
- [ ] All six `NS*UsageDescription` strings present and verbatim
- [ ] `ENABLE_USER_SCRIPT_SANDBOXING = NO` — archive succeeds

### Maps
- [ ] `pod 'react-native-maps/Google'` present **before** `use_react_native!`
- [ ] `import GoogleMaps` compiles in `AppDelegate.swift`
- [ ] `configureGoogleMaps()` is the **first statement** of `didFinishLaunchingWithOptions`
- [ ] `GoogleMaps` + `Google-Maps-iOS-Utils` in the new `Podfile.lock`
- [ ] `GMSApiKey` = `$(MAPS_API_KEY)` in `Info.plist`; xcconfig chain intact
- [ ] Maps render **Google** tiles with the custom style — **not Apple Maps**
- [ ] iOS map appearance matches Android

### Visual identity
- [ ] All **21** `AppIcon` PNGs + `Contents.json` copied; 1024×1024 marketing icon present
- [ ] TestFlight shows the correct icon (not a default/blank tile)
- [ ] `LaunchScreen.storyboard` **and** `LeafLogo.imageset` copied; leaf renders centred on white
- [ ] Launch screen matches Android's native splash
- [ ] Inter fonts render (not the system fallback)
- [ ] `MaterialCommunityIcons` glyphs visible
- [ ] App stays in **light mode** under system dark mode
- [ ] iPhone locked to portrait; iPad rotates

### Build config
- [ ] `RCT_USE_PREBUILT_RNCORE = '0'` in the Podfile; Debug simulator build links
- [ ] `RCTNewArchEnabled` = `true`; `USE_HERMES` = `true`
- [ ] Deployment target `15.1`; `TARGETED_DEVICE_FAMILY` `1,2`
- [ ] 7 build phases in the documented order
- [ ] `.xcode.env` copied; `.xcode.env.local` **not** copied

### 🔴 The definitive end-to-end test
- [ ] Install the **current** TestFlight build on a device, sign in
- [ ] Install the **migrated** build over it
- [ ] Confirm it installs as an **update** (not a second app icon)
- [ ] Confirm you are **still signed in** — this proves bundle ID, team and the implicit keychain
      access group are all unchanged (§7)

---

## 17. Summary — iOS lock-list

| Value | Must equal | Severity |
|---|---|---|
| `PRODUCT_BUNDLE_IDENTIFIER` | `com.amitbaser.iigrain` | 🔴 Unrecoverable |
| `DEVELOPMENT_TEAM` | `SADMK33W84` | 🔴 Unrecoverable + keychain |
| `CURRENT_PROJECT_VERSION` | ≥ `10` | 🔴 Blocks upload |
| `ITSAppUsesNonExemptEncryption` | `false` | 🔴 Stalls every upload |
| `PrivacyInfo.xcprivacy` | Verbatim | 🔴 Upload warning / rejection |
| 6 × `NS*UsageDescription` | Verbatim | 🔴 Runtime crashes |
| Entitlements file | **must not exist** | 🔴 Validation failure |
| `react-native-maps/Google` subspec | Present | 🔴 Silent Apple-Maps fallback |
| `GMSApiKey` chain | Intact | 🔴 Blank maps |
| `RCT_USE_PREBUILT_RNCORE` | `'0'` | 🔴 Debug link failure |
| `ENABLE_USER_SCRIPT_SANDBOXING` | `NO` | 🔴 Archive failure |
| `AppIcon.appiconset` (21 files) | Complete | 🔴 Visible to all testers |
| `CFBundleDisplayName` | `iiGrain` | 🟠 Visible |
| `LaunchScreen` + `LeafLogo` | Both | 🟠 Visible |
| `IPHONEOS_DEPLOYMENT_TARGET` | `15.1` | 🟠 Loses users if raised |
| `TARGETED_DEVICE_FAMILY` | `1,2` | 🟠 iPad support |
| `UIUserInterfaceStyle` | `Light` | 🟠 Visible |
| ATS dict | `false` / `true` | 🟠 Security + dev builds |
| Push / capabilities | None — add nothing | 🔴 if added |
| Firebase | None — add nothing | 🟢 |
| Provisioning profile | Nothing to copy (automatic) | 🟢 |
