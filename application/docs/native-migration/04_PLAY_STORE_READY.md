# 04 — Play Store Ready (Android Identity Lock-List)

> Every Android value that **must remain byte-identical** after migration so the existing Google
> Play listing continues to receive updates instead of becoming a second, separate app.
>
> Rule of thumb: Google Play identifies an app by **`applicationId` + signing certificate**. Get
> either wrong and there is no recovery path other than publishing a brand-new listing and losing
> all installs, ratings and reviews.

---

## 0. The two things that actually decide success

| # | Value | Consequence of change |
|---|---|---|
| 1 | **`applicationId` = `com.iigrain`** | A different ID is a **different app**. The old listing can never be updated from the new project. Installs, reviews, ratings, and history are all stranded. |
| 2 | **Signing certificate** | Google Play rejects any upload signed with a certificate that does not match the registered upload key: *"Your Android App Bundle is signed with the wrong key."* |

Everything else in this document is recoverable with a follow-up release. **These two are not.**

---

## 1. Application ID — 🔴 MUST NOT CHANGE

| Field | Required value | Location in fresh project |
|---|---|---|
| `applicationId` | `com.iigrain` | `android/app/build.gradle` → `defaultConfig.applicationId` |
| `namespace` | `com.iigrain` | `android/app/build.gradle` → `android.namespace` |
| Kotlin package | `com.iigrain` | `android/app/src/main/java/com/iigrain/` + `package com.iigrain` in both `.kt` files |

### Verification before upload

```bash
# From the built AAB/APK — must print: package: name='com.iigrain'
aapt2 dump badging app-release.aab | head -1
```

> ⚠️ Do **not** "harmonise" the Android ID with the iOS bundle ID (`com.amitbaser.iigrain`). They
> differ, and that difference is part of the shipped identity of both apps.

### Derived value (automatic — no action needed)

The permission `com.iigrain.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` is generated from the
application ID by AndroidX/React Native. Keeping `applicationId` correct keeps this correct.

---

## 2. Signing — 🔴 THE BLOCKING ISSUE

### 2.1 What the repository actually contains

| Artefact | Status |
|---|---|
| `android/app/debug.keystore` | ✅ Present, **committed**. Standard AOSP debug keystore (`androiddebugkey`, password `android`). Not a release identity. |
| `signingConfigs { release { … } }` | ❌ **Does not exist.** |
| `buildTypes.release.signingConfig` | ⚠️ **Points at `signingConfigs.debug`.** |
| `application/your_key_name.keystore` | ⚠️ Present (2 744 bytes) but **untracked** (gitignored via `*.keystore`) and **referenced by no Gradle file**. |
| `keystore.properties` / `*.keystore.properties` | ❌ None (gitignored pattern exists; no file). |
| Signing credentials in CI config | ❌ No CI config found in the repository. |

### 2.2 What this means

**The Gradle configuration in this repository cannot produce a Play-Store-acceptable release
build.** A release AAB built from it would be signed with the public, universally-known debug
certificate — which Google Play rejects for a new app and would never match an existing upload key.

Therefore the live Play Store binary (if one exists) was signed **outside this configuration** —
almost certainly one of:

* Android Studio → *Build → Generate Signed Bundle / APK*, selecting `your_key_name.keystore`
  manually, or
* a CI pipeline holding the keystore and credentials as secrets, or
* an entirely different build machine or contractor's checkout.

### 2.3 🔴 Required actions BEFORE starting the migration

These are **information-gathering tasks that cannot be completed from the repository**. Do them
first — a migration that finishes without them is not shippable.

- [ ] **Confirm whether the app is actually live on Google Play.** `versionCode` is still `1`, which
      suggests it may never have shipped. If it has not, the signing constraint disappears and you
      simply create a proper upload key.
- [ ] **Locate the real upload keystore.** Verify whether `application/your_key_name.keystore` is
      it, or whether the true keystore lives only on a publisher's machine / in CI secrets.
- [ ] **Obtain the credentials**: store password, key alias, key password. These exist nowhere in
      this repository.
- [ ] **Check Play App Signing status** in Play Console → *Setup → App integrity*.
      - **Enabled** → Google holds the app-signing key; you only need the **upload** key, and it can
        be reset with Google's help if lost.
      - **Disabled** → the upload key **is** the app-signing key. Losing it permanently ends the
        ability to update this listing. There is no recovery.
- [ ] **Record both certificate fingerprints** (SHA-1 and SHA-256) from Play Console → *App
      integrity*, for both the upload certificate and the app-signing certificate. You need these
      for §4 (Maps key restrictions).
- [ ] **Back up the keystore** to secure storage before touching anything.

### 2.4 Recommended signing setup in the fresh project

Do **not** reproduce `release { signingConfig signingConfigs.debug }`. Instead, wire a real release
config that reads credentials from outside version control:

```
android/keystores/                 ← already gitignored
gradle.properties (user-global, ~/.gradle/gradle.properties)
  IIGRAIN_UPLOAD_STORE_FILE=…
  IIGRAIN_UPLOAD_STORE_PASSWORD=…
  IIGRAIN_UPLOAD_KEY_ALIAS=…
  IIGRAIN_UPLOAD_KEY_PASSWORD=…
```

The existing `.gitignore` already anticipates this — it ignores `android/keystores/`, `*.keystore`
(except `debug.keystore`), `*.jks` and `*.keystore.properties`. **Carry those ignore rules over.**

> This is the one place where the migration should **not** faithfully reproduce the current state.
> Preserving the *certificate* is mandatory; preserving the *misconfiguration that signs release
> with the debug key* is not.

---

## 3. Versioning — 🔴 MUST BE MONOTONIC

| Field | Current repo value | What to use |
|---|---|---|
| `versionCode` | `1` | **Read the highest accepted `versionCode` from Play Console and use a strictly greater integer.** Do not assume `2`. |
| `versionName` | `"1.0"` | Any human-readable string; `"1.0"` is safe if the listing has not moved past it |

Google Play permanently rejects an upload whose `versionCode` is less than or equal to one already
accepted — **even for a deleted or superseded release**. This value cannot be recovered from the
repository, only from the Console.

> Cross-platform note: iOS is at `2.0 (9)` while Android reads `1.0 (1)`. Do not copy iOS's numbers
> across; each store tracks its own sequence.

---

## 4. Google Maps — 🔴 SILENT PRODUCTION FAILURE RISK

### 4.1 The key and where it lives

| # | Location | Tracked? | Active? |
|---|---|---|---|
| 1 | `android/app/src/main/AndroidManifest.xml` → `com.google.android.geo.API_KEY` | ✅ yes | ✅ **yes — a hardcoded literal** |
| 2 | `android/gradle.properties` → `MAPS_API_KEY` | ✅ yes | ❌ no (nothing reads it) |
| 3 | `application/.env` → `MAPS_API_KEY` | ❌ gitignored | ❌ no (feeds an unused placeholder) |

Key value: begins `AIzaSy`, ends `mBHOQ`, 37 characters. **Deliberately not reproduced in full
here** — it is already exposed in two committed files.

**Requirement: the value must not change.** A different key changes billing attribution, quota, and
restriction scope.

### 4.2 🔴 The SHA-1 restriction trap

`android/gradle.properties` carries the project's own instruction:

> *"Keep this restricted in Google Cloud by package + SHA-1/SHA-256."*

Android Maps API keys are typically restricted to **package name + signing-certificate
fingerprint**. That means:

> **An unchanged Maps API key + unchanged package name is NOT sufficient.** If the migrated build is
> signed with a certificate whose SHA-1 is not on the key's allow-list, every map renders as a blank
> grey grid with `Authorization failure` in logcat — **and the build succeeds silently.** It will
> pass local testing on a debug build and fail only in production.

### Required actions

- [ ] Open Google Cloud Console → *APIs & Services → Credentials* → the Maps Android key.
- [ ] Record its **Application restrictions**: which package names and which SHA-1 fingerprints.
- [ ] Confirm the fingerprint of the certificate your migrated release will be signed with (from
      §2.3) is on that list. **If Play App Signing is enabled, the fingerprint that matters is
      Google's app-signing certificate, not your upload certificate.**
- [ ] Add the debug keystore's SHA-1 too, if developers need working maps locally.
- [ ] After the first migrated release, **verify maps render on a real production install** — not
      just on a debug build.

### 4.3 Pinned Play Services versions — must carry over

From `android/build.gradle` → `buildscript.ext`:

```groovy
googlePlayServicesMapsVersion     = "19.1.0"
googlePlayServicesBaseVersion     = "18.5.0"
googlePlayServicesLocationVersion = "21.3.0"
```

Read by `react-native-maps` via its `safeExtGet()` helper. Dropping them does not break the build —
it silently un-pins the Maps SDK version inside the APK, changing map rendering and location
behaviour between releases. The in-file comment states the intent explicitly: making the map stack
"an explicit, reviewable part of THIS project's dependency graph."

### 4.4 Manifest meta-data that must be present

```xml
<meta-data android:name="com.google.android.geo.API_KEY" android:value="…" />
<meta-data android:name="com.google.android.gms.version"
           android:value="@integer/google_play_services_version" />
```

Both must live **inside `<application>`**. The manifest's own comment records that outside it the
merger drops the key element and every map goes blank. The `gms.version` value must stay the
`@integer/` reference — never a hardcoded number.

---

## 5. Firebase — nothing to preserve

| Checked | Result |
|---|---|
| `google-services.json` | ❌ absent from the entire repository |
| `com.google.gms.google-services` plugin | ❌ not applied |
| Any `com.google.firebase:*` dependency | ❌ none |
| Crashlytics / Performance | ❌ none |

**Action: add nothing.** Introducing a `google-services.json` during migration would *change*
behaviour, not preserve it. There is no Firebase identity at risk.

---

## 6. Notifications

| Aspect | Current state | Migration action |
|---|---|---|
| Library | `@notifee/react-native` 9.1.8 → `io.invertase.notifee.NotifeePackage` | Install the same version; autolinking handles the rest |
| Push / FCM | ❌ **Not configured** — no Firebase, so **local & scheduled notifications only** | Add nothing |
| Native config files | ❌ None — no channel XML, no receiver/service in the local manifest | Nothing to copy |
| Custom notification icon | ❌ None — falls back to `@mipmap/ic_launcher` | Ship the same launcher icon (§8) and the notification icon matches automatically |
| Channels | Created from JavaScript at runtime | Out of native scope |
| Merged-in components | `NotifeeInitProvider` + AndroidX WorkManager infrastructure | Automatic via manifest merge |

**Permissions Notifee contributes** (via manifest merge, not the local manifest):
`POST_NOTIFICATIONS`, `VIBRATE`, `WAKE_LOCK`, `RECEIVE_BOOT_COMPLETED`, `FOREGROUND_SERVICE`,
`SCHEDULE_EXACT_ALARM`, `BROADCAST_CLOSE_SYSTEM_DIALOGS`, `ACCESS_NOTIFICATION_POLICY`.

> These appear in the Play Store's user-facing permission list. Keeping the same Notifee version
> keeps the list identical. A **major** Notifee upgrade during migration could add or remove
> permissions and change the store listing — do the version bump separately.

---

## 7. Permissions — the published permission set

Google Play surfaces the merged permission set to users, and **adding** a sensitive permission can
trigger a policy review (or a Data Safety form update). Reproduce the set exactly.

### 7.1 Declared in `AndroidManifest.xml` — copy verbatim

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
<uses-permission android:name="android.permission.READ_MEDIA_VIDEO" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"
                 android:maxSdkVersion="32" />

<uses-feature android:name="android.hardware.camera" android:required="false" />
```

> 🟠 **`android:maxSdkVersion="32"` on `READ_EXTERNAL_STORAGE` is load-bearing.** Dropping it makes
> the app request broad storage access on Android 13+, which Google Play treats as a sensitive
> permission requiring a declaration form.
>
> 🟠 **`android:required="false"` on the camera feature is load-bearing.** Changing it to `true`
> removes the app from Google Play for camera-less devices, shrinking the eligible install base.

### 7.2 Merged in from libraries — expect these, do not hand-add

| Permission | Source |
|---|---|
| `USE_BIOMETRIC`, `USE_FINGERPRINT` | `react-native-keychain` |
| `WRITE_EXTERNAL_STORAGE` (capped), `SYSTEM_ALERT_WINDOW` | `react-native-image-crop-picker` |
| `ACCESS_NETWORK_STATE` | Google Maps / Play Services |
| 8 notification permissions | `@notifee/react-native` (§6) |
| `com.iigrain.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` | AndroidX / RN, derived from `applicationId` |

### 7.3 Verification

```bash
# Compare old vs new merged manifests — the permission sets must match
diff <(aapt2 dump permissions old-release.aab) \
     <(aapt2 dump permissions new-release.aab)
```

Run this **before** the first migrated upload. Any diff is a potential Play policy issue.

---

## 8. Icons and store visual identity

| Resource | Requirement |
|---|---|
| `@mipmap/ic_launcher` | 5 densities: 48 / 72 / 96 / 144 / 192 px |
| `@mipmap/ic_launcher_round` | 5 densities: 48 / 72 / 96 / 144 / 192 px |
| `@mipmap/ic_launcher_foreground` | 5 densities: 108 / 162 / 216 / 324 / 432 px |
| `mipmap-anydpi-v26/ic_launcher.xml` + `ic_launcher_round.xml` | Adaptive icon definitions |
| `@color/ic_launcher_background` | `#FFFFFF` |

Full inventory in `06_APP_ICONS.md`.

> The **Play Store listing icon** (512 × 512) is uploaded to the Console and is **not** in this
> repository — it is unaffected by the migration. The in-APK launcher icon above is what changes if
> you get this wrong.

---

## 9. Deep links — nothing to preserve

| Checked | Result |
|---|---|
| `<data android:scheme=…>` | ❌ none |
| `ACTION_VIEW` intent filters | ❌ none |
| `BROWSABLE` category | ❌ none |
| `android:autoVerify` / App Links | ❌ none |
| `assetlinks.json` | ❌ none |

The only intent filter in the app is `MAIN` / `LAUNCHER` on `MainActivity`.

**Action: reproduce exactly one intent filter.** Adding a deep-link filter would change how the app
appears in Android's "Open by default" settings and in link-handling dialogs.

---

## 10. Behavioural settings that affect users on update

Not identity, but a change here is visible to existing users after an update — verify each.

| Setting | Value | Effect if changed |
|---|---|---|
| `android:allowBackup="false"` | `false` | Setting `true` would start including app data in Google Backup — a Data Safety declaration change |
| `android:screenOrientation="portrait"` | portrait | The app would start rotating; the splash video restarts from frame 0 on rotation |
| `android:launchMode="singleTask"` | `singleTask` | Changes back-stack and task behaviour |
| `android:usesCleartextTraffic` | `${usesCleartextTraffic}` placeholder | Hardcoding `true` weakens network security in release builds |
| `minSdkVersion 24` | `24` | **Raising it removes the app from Google Play for existing users on older devices** — they stop receiving updates |
| `targetSdkVersion 36` | `36` | Lowering it may fall below Google Play's minimum target-API requirement and block uploads |
| `AppTheme` `statusBarColor` `#167A45` | green | Visible UI regression |
| `forceDarkAllowed="false"` | `false` | The app would start following system dark mode |
| ABI list `armeabi-v7a,arm64-v8a,x86,x86_64` | 4 ABIs | Dropping an ABI makes the app unavailable to those devices |

---

## 11. Play-Store pre-flight checklist

Run through this **before** uploading the first migrated build.

### Identity
- [ ] `aapt2 dump badging` shows `package: name='com.iigrain'`
- [ ] `versionCode` > highest value in Play Console
- [ ] Launcher label reads `iiGrain` (`@string/app_name`)
- [ ] `minSdkVersion 24`, `targetSdkVersion 36`, `compileSdk 36`

### Signing
- [ ] Release build uses the **real upload keystore**, not `debug.keystore`
- [ ] `apksigner verify --print-certs` SHA-1 matches the Play Console upload certificate
- [ ] Play App Signing status confirmed and recorded
- [ ] Keystore + credentials backed up to secure storage
- [ ] Keystore is **not** committed (`.gitignore` rules carried over)

### Maps
- [ ] `com.google.android.geo.API_KEY` present **inside `<application>`** with the unchanged key
- [ ] `com.google.android.gms.version` present as `@integer/google_play_services_version`
- [ ] Three `googlePlayServices*Version` ext pins present in `android/build.gradle`
- [ ] Signing certificate SHA-1 present on the Maps key's allow-list in Google Cloud Console
- [ ] **Maps verified rendering on a production-signed install**, not just a debug build

### Permissions
- [ ] `diff` of merged permission sets (old vs new) is empty
- [ ] `READ_EXTERNAL_STORAGE` still carries `android:maxSdkVersion="32"`
- [ ] Camera `uses-feature` still `android:required="false"`

### Assets & behaviour
- [ ] All 15 `ic_launcher*` PNGs + 2 adaptive XMLs present; launcher icon correct on an API 26+ device
- [ ] `splash_icon` renders (5 densities present)
- [ ] Status bar is green; app does not follow system dark mode
- [ ] App is locked to portrait
- [ ] Inter fonts render (not the system fallback)
- [ ] `MaterialCommunityIcons.ttf` bundled — icons visible

### Custom native code
- [ ] `MainApplication.kt` contains the **IPv4-preferred OkHttp DNS factory**
- [ ] `MainActivity.kt` contains `installSplashScreen()`, `setDecorFitsSystemWindows(false)`, `super.onCreate(null)`
- [ ] `getMainComponentName()` returns `"iiGrain"`

### Hygiene
- [ ] **`android/app/src/main/assets/index.android.bundle` is NOT present** in the new project
- [ ] `local.properties` not committed
- [ ] Internal-testing track install verified as an **in-place update over the existing app**, not a
      side-by-side second install — this is the definitive proof that identity is preserved

---

## 12. Summary — Android lock-list

| Value | Must equal | Severity |
|---|---|---|
| `applicationId` / `namespace` | `com.iigrain` | 🔴 Unrecoverable |
| Signing certificate | Existing upload key (**must be sourced externally**) | 🔴 Unrecoverable |
| `versionCode` | > highest accepted in Play Console | 🔴 Blocks upload |
| Maps API key | Unchanged value | 🔴 Blank maps |
| Maps key SHA-1 allow-list | Must include the new build's signing certificate | 🔴 Silent blank maps in production |
| `app_name` | `iiGrain` | 🟠 Visible |
| `minSdkVersion` | `24` | 🟠 Loses users if raised |
| Permission set | Identical merged set | 🟠 Policy review risk |
| Play Services pins | `19.1.0` / `18.5.0` / `21.3.0` | 🟠 Silent SDK drift |
| Intent filters | Exactly one MAIN/LAUNCHER | 🟢 |
| Firebase | None — add nothing | 🟢 |
| Deep links | None — add nothing | 🟢 |
