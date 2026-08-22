# 06 — App Icons, Splash & Launch Assets

> Complete inventory of every icon and launch asset in `android/` and `ios/`, with measured pixel
> dimensions. All dimensions below were read from the PNG headers during this audit — they are
> measured, not assumed.

---

## 1. At a glance

| Asset family | Platform | Location | Files | Status |
|---|---|---|---|---|
| Launcher icon (legacy) | Android | `res/mipmap-*/ic_launcher.png` | 5 | ✅ branded |
| Launcher icon (round) | Android | `res/mipmap-*/ic_launcher_round.png` | 5 | ✅ branded |
| Adaptive foreground | Android | `res/mipmap-*/ic_launcher_foreground.png` | 5 | ✅ branded |
| Adaptive icon definitions | Android | `res/mipmap-anydpi-v26/*.xml` | 2 | ✅ |
| Adaptive background | Android | `@color/ic_launcher_background` = `#FFFFFF` | — | colour, not a drawable |
| Adaptive monochrome | Android | — | 0 | ❌ **absent** |
| Splash icon | Android | `res/drawable-*/splash_icon.png` | 5 | ✅ generated |
| Notification icon | Android | — | 0 | ❌ **absent** (falls back to launcher) |
| App icon | iOS | `Images.xcassets/AppIcon.appiconset/` | 21 + JSON | ✅ branded |
| Launch screen image | iOS | `Images.xcassets/LeafLogo.imageset/leaf.png` | 1 | ✅ generated |
| Launch images (legacy) | iOS | — | 0 | ❌ absent (storyboard only — correct) |
| Alternate app icons | iOS | — | 0 | ❌ absent |
| Dark / tinted icon variants | iOS | — | 0 | ❌ absent |
| Master branding source | shared | `branding/splash_master.png` | 1 | ✅ 59 835 bytes |
| Generator script | shared | `scripts/gen_splash_assets.py` | 1 | ✅ |

---

## 2. Android — launcher icon

### 2.1 Referenced from the manifest

```xml
<application
    android:icon="@mipmap/ic_launcher"
    android:roundIcon="@mipmap/ic_launcher_round"
    … >
```

### 2.2 `ic_launcher.png` — legacy square icon

| Density | Path | Measured size |
|---|---|---|
| mdpi | `android/app/src/main/res/mipmap-mdpi/ic_launcher.png` | **48 × 48** |
| hdpi | `android/app/src/main/res/mipmap-hdpi/ic_launcher.png` | **72 × 72** |
| xhdpi | `android/app/src/main/res/mipmap-xhdpi/ic_launcher.png` | **96 × 96** |
| xxhdpi | `android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png` | **144 × 144** |
| xxxhdpi | `android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png` | **192 × 192** |

Used on API < 26, and as the fallback for anything that does not read the adaptive icon.

### 2.3 `ic_launcher_round.png` — round icon

| Density | Path | Measured size |
|---|---|---|
| mdpi | `res/mipmap-mdpi/ic_launcher_round.png` | **48 × 48** |
| hdpi | `res/mipmap-hdpi/ic_launcher_round.png` | **72 × 72** |
| xhdpi | `res/mipmap-xhdpi/ic_launcher_round.png` | **96 × 96** |
| xxhdpi | `res/mipmap-xxhdpi/ic_launcher_round.png` | **144 × 144** |
| xxxhdpi | `res/mipmap-xxxhdpi/ic_launcher_round.png` | **192 × 192** |

Used by launchers on API 25 that request round icons.

### 2.4 `ic_launcher_foreground.png` — adaptive icon foreground

| Density | Path | Measured size |
|---|---|---|
| mdpi | `res/mipmap-mdpi/ic_launcher_foreground.png` | **108 × 108** |
| hdpi | `res/mipmap-hdpi/ic_launcher_foreground.png` | **162 × 162** |
| xhdpi | `res/mipmap-xhdpi/ic_launcher_foreground.png` | **216 × 216** |
| xxhdpi | `res/mipmap-xxhdpi/ic_launcher_foreground.png` | **324 × 324** |
| xxxhdpi | `res/mipmap-xxxhdpi/ic_launcher_foreground.png` | **432 × 432** |

Note these are **108 dp** canvases (the adaptive-icon standard), i.e. 2.25× the corresponding
`ic_launcher` size at every density — the extra area is the bleed the system crops when applying
masks and parallax.

**Total: 15 PNG files** across the three families.

---

## 3. Android — adaptive icon (API 26+)

### 3.1 `mipmap-anydpi-v26/ic_launcher.xml`

```xml
<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
</adaptive-icon>
```

### 3.2 `mipmap-anydpi-v26/ic_launcher_round.xml`

**Byte-identical** to `ic_launcher.xml` — same background colour, same foreground drawable.

### 3.3 Layers

| Layer | Value | Notes |
|---|---|---|
| **Background** | `@color/ic_launcher_background` = `#FFFFFF` | A **colour resource**, not a drawable. Defined in `res/values/colors.xml` with the comment *"Adaptive launcher icon background (leaf mark sits on white)"*. |
| **Foreground** | `@mipmap/ic_launcher_foreground` | The leaf mark, 5 densities (§2.4). |
| **Monochrome** | ❌ **absent** | No `<monochrome>` layer → **no themed-icon support on Android 13+**. The launcher will not tint the icon to match the user's wallpaper theme. This matches current shipped behaviour — do not add one during migration. |

### 3.4 What each Android version actually shows

| Android version | Icon shown |
|---|---|
| API < 26 | `ic_launcher.png` / `ic_launcher_round.png` (raster) |
| API 26–32 | Adaptive icon: white background + leaf foreground, masked by the launcher |
| API 33+ | Same adaptive icon. **Themed icons unavailable** (no monochrome layer) |

---

## 4. Android — splash icon

### 4.1 Files

| Density | Path | Measured size |
|---|---|---|
| mdpi | `res/drawable-mdpi/splash_icon.png` | **288 × 288** |
| hdpi | `res/drawable-hdpi/splash_icon.png` | **432 × 432** |
| xhdpi | `res/drawable-xhdpi/splash_icon.png` | **576 × 576** |
| xxhdpi | `res/drawable-xxhdpi/splash_icon.png` | **864 × 864** |
| xxxhdpi | `res/drawable-xxxhdpi/splash_icon.png` | **1152 × 1152** |

A **288 dp canvas** at 1× / 1.5× / 2× / 3× / 4×.

### 4.2 How it is wired

```xml
<!-- res/values/styles.xml -->
<style name="Theme.App.SplashScreen" parent="Theme.SplashScreen">
    <item name="windowSplashScreenBackground">@color/splash_background</item>
    <item name="windowSplashScreenAnimatedIcon">@drawable/splash_icon</item>
    <item name="postSplashScreenTheme">@style/AppTheme</item>
</style>
```

* Applied as `MainActivity`'s **launch theme** in `AndroidManifest.xml`
* `installSplashScreen()` (first line of `MainActivity.onCreate`) swaps to `AppTheme` when RN is ready
* Library: `androidx.core:core-splashscreen:1.0.1`
* Background: `@color/splash_background` = **`#FFFFFF`**

### 4.3 Why 288 dp

From the generator's docstring: Android's SplashScreen API **scales the icon drawable to fill a
288 dp icon slot**. The drawable is therefore authored as a 288 dp canvas with the leaf sized to
**67 dp** and centred. The transparent margin is the safe zone — the leaf stays well inside the
circular mask Android 12+ applies, so it is never clipped.

---

## 5. Android — notification icon

**There is none.** Verified absent:

| Checked | Result |
|---|---|
| `ic_notification` / `ic_stat_*` drawable | ❌ none |
| `notifee_*` meta-data in the manifest | ❌ none |
| `com.google.firebase.messaging.default_notification_icon` | ❌ none |
| Notification colour meta-data | ❌ none |

**Consequence:** Android falls back to **`@mipmap/ic_launcher`** for notification small icons.

> On API 21+ the system renders the small icon as a **white silhouette from the alpha channel**. A
> full-colour launcher icon typically renders as a solid white blob. That is the current shipped
> behaviour.
>
> **Do not "fix" this during the migration** — adding a proper monochrome notification icon changes
> how every notification looks. Ship it as a separate, deliberate change.

---

## 6. iOS — `AppIcon.appiconset`

**Path:** `ios/iiGrain/Images.xcassets/AppIcon.appiconset/`
**Selected by:** `ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon` (target, both configs)
**Generated by:** **IconKitchen** — `Contents.json` → `"author": "iconkitchen"`, `"version": 1`

### 6.1 All 21 PNG files with measured dimensions

| # | Filename | Measured | `Contents.json` size | Idiom | Scale |
|---|---|---|---|---|---|
| 1 | `AppIcon-20~ipad.png` | **20 × 20** | 20×20 | ipad | 1x |
| 2 | `AppIcon-20@2x.png` | **40 × 40** | 20×20 | iphone | 2x |
| 3 | `AppIcon-20@2x~ipad.png` | **40 × 40** | 20×20 | ipad | 2x |
| 4 | `AppIcon-20@3x.png` | **60 × 60** | 20×20 | iphone | 3x |
| 5 | `AppIcon-29.png` | **29 × 29** | 29×29 | iphone | 1x |
| 6 | `AppIcon-29~ipad.png` | **29 × 29** | 29×29 | ipad | 1x |
| 7 | `AppIcon-29@2x.png` | **58 × 58** | 29×29 | iphone | 2x |
| 8 | `AppIcon-29@2x~ipad.png` | **58 × 58** | 29×29 | ipad | 2x |
| 9 | `AppIcon-29@3x.png` | **87 × 87** | 29×29 | iphone | 3x |
| 10 | `AppIcon-40~ipad.png` | **40 × 40** | 40×40 | ipad | 1x |
| 11 | `AppIcon-40@2x.png` | **80 × 80** | 40×40 | iphone | 2x |
| 12 | `AppIcon-40@2x~ipad.png` | **80 × 80** | 40×40 | ipad | 2x |
| 13 | `AppIcon-40@3x.png` | **120 × 120** | 40×40 | iphone | 3x |
| 14 | `AppIcon@2x.png` | **120 × 120** | 60×60 | iphone | 2x |
| 15 | `AppIcon@3x.png` | **180 × 180** | 60×60 | iphone | 3x |
| 16 | `AppIcon~ipad.png` | **76 × 76** | 76×76 | ipad | 1x |
| 17 | `AppIcon@2x~ipad.png` | **152 × 152** | 76×76 | ipad | 2x |
| 18 | `AppIcon-83.5@2x~ipad.png` | **167 × 167** | 83.5×83.5 | ipad | 2x |
| 19 | `AppIcon-60@2x~car.png` | **120 × 120** | 60×60 | **car** | 2x |
| 20 | `AppIcon-60@3x~car.png` | **180 × 180** | 60×60 | **car** | 3x |
| 21 | `AppIcon~ios-marketing.png` | **1024 × 1024** | 1024×1024 | **ios-marketing** | 1x |

Every measured dimension matches its declared `size × scale`. The set is internally consistent.

### 6.2 Coverage notes

| Observation | Detail |
|---|---|
| **CarPlay icons present** | Entries 19–20 use the `car` idiom. Unusual for a farm app; harmless — IconKitchen emits the full set. Copy them; removing them changes the asset catalogue. |
| **Marketing icon inside the appiconset** | Entry 21 at 1024 × 1024. This is what App Store Connect and TestFlight display. |
| **No `mac` / `watch` idioms** | Correct for an iPhone/iPad app. |
| **No appearance variants** | No `"appearances"` keys → **no iOS 18 dark or tinted icon variants**. The single light icon is used in all modes. |
| **No alternate icons** | `CFBundleIcons` / `CFBundleAlternateIcons` absent from `Info.plist`. |

### 6.3 🔴 Which icon the current TestFlight build uses

**`ios/iiGrain/Images.xcassets/AppIcon.appiconset` — all 21 files, with
`AppIcon~ios-marketing.png` (1024 × 1024) as the App Store / TestFlight listing icon.**

There is exactly **one** app-icon asset set in the project. There are no alternates, no variants and
no build-configuration-specific icon overrides, so what testers see today is unambiguous:

* **On-device home screen (iPhone)** → `AppIcon@2x.png` (120 × 120) or `AppIcon@3x.png` (180 × 180)
* **On-device home screen (iPad)** → `AppIcon@2x~ipad.png` (152 × 152) or
  `AppIcon-83.5@2x~ipad.png` (167 × 167) on iPad Pro
* **TestFlight app list & App Store Connect** → `AppIcon~ios-marketing.png` (1024 × 1024)
* **Settings / Spotlight / notifications** → the 29 pt and 40 pt variants

> **Migration action: copy the entire `AppIcon.appiconset` directory verbatim, `Contents.json`
> included.** Do **not** regenerate it with a different tool — a different generator produces
> different filenames and a different `Contents.json` mapping. If the set is incomplete, the upload
> either fails validation with a missing-icon error or TestFlight shows a blank tile to every
> tester. Highly visible, and it looks like a broken build.

---

## 7. iOS — launch screen image (`LeafLogo`)

**Path:** `ios/iiGrain/Images.xcassets/LeafLogo.imageset/`

### `Contents.json`

```json
{
  "images" : [ { "filename" : "leaf.png", "idiom" : "universal" } ],
  "info" : { "author" : "xcode", "version" : 1 },
  "properties" : { "template-rendering-intent" : "original" }
}
```

| Property | Value |
|---|---|
| File | `leaf.png` |
| Measured size | **432 × 432** |
| Idiom | `universal` |
| Scale variants | **None** — a single unscaled entry, no @2x/@3x |
| Rendering intent | `original` — renders with its own colours, **never tinted** as a template |
| Consumed by | `LaunchScreen.storyboard` only |
| Author | `xcode` (unlike AppIcon's `iconkitchen`) |

> `"template-rendering-intent": "original"` is load-bearing. As a template, the green leaf would
> render as a flat tint silhouette on the launch screen.

---

## 8. iOS — launch screen

**`ios/iiGrain/LaunchScreen.storyboard`** — see `03_IOS_CONFIGURATION.md` §7 for the full breakdown.

| Property | Value |
|---|---|
| `Info.plist` key | `UILaunchStoryboardName = LaunchScreen` |
| Build phase | Member of `PBXResourcesBuildPhase` |
| Background | `#FFFFFF` (sRGB, r=1 g=1 b=1 a=1) |
| Content | One `UIImageView` |
| Image | `LeafLogo` |
| Image view size | **160 × 160 pt** (fixed width + height constraints) |
| Content mode | `scaleAspectFit` |
| Position | Centred (`centerX` + `centerY` against the root view) |
| Root view frame | 393 × 852 (`retina6_12` preview) |
| Uses safe areas | `YES` |

**No legacy launch images.** There is no `LaunchImage.launchimage` asset set and no
`UILaunchImages` array — correct for a modern iOS app.

---

## 9. The shared splash system — one master, two platforms

### 9.1 Source of truth

| File | Detail |
|---|---|
| `branding/splash_master.png` | 59 835 bytes. Square PNG, transparent background, logo roughly centred. Native leaf resolution ≈ 150 × 181 px. |
| `scripts/gen_splash_assets.py` | Python 3 + Pillow. Generates **both** platforms' splash assets. |

### 9.2 The 67 dp/pt calibration

`TARGET_LEAF_DP = 67` — the on-screen leaf height, **identical on iOS and Android**, so users cannot
tell the two splash screens apart.

| Platform | Canvas | Mechanism | On-screen |
|---|---|---|---|
| **Android** | 288 dp (`ANDROID_CANVAS_DP`) at 1×–4× → 288 / 432 / 576 / 864 / 1152 px | SplashScreen API scales the drawable into a 288 dp icon slot | **67 dp** |
| **iOS** | 432 px (`IOS_CANVAS_PX`) | Storyboard aspect-fits the whole imageset into a 160 pt view (`IOS_IMAGEVIEW_PT`) | **67 pt** |

The docstring records why 67: it matches what iOS already shipped, and keeps the upscale factor from
the master's native leaf resolution under ~1.5× even on the densest Android bucket, so the leaf never
looks blurry.

### 9.3 To rebrand (documented in the script)

1. Replace `branding/splash_master.png` with the new logo (square PNG, transparent background,
   logo roughly centred)
2. Run `python scripts/gen_splash_assets.py`
3. Rebuild both apps

> 🔴 **Never hand-edit `splash_icon.png` or `leaf.png`, and never change the 160 pt storyboard
> constraints or the 288 dp Android canvas.** The 432 px canvas → 160 pt view → 67 pt leaf, and the
> 288 dp canvas → 67 dp leaf, are one calibrated system. Editing one side silently desynchronises the
> two platforms' splash screens — the exact drift the generator exists to prevent.

### 9.4 The full white-background chain

Three separate settings are all `#FFFFFF` deliberately, so the startup sequence
*native splash → JS video splash → app* never flashes a different colour:

| Setting | File | Value |
|---|---|---|
| `@color/splash_background` | `android/res/values/colors.xml` | `#FFFFFF` |
| `AppTheme` → `android:windowBackground` | `android/res/values/styles.xml` | `@android:color/white` |
| LaunchScreen root view `backgroundColor` | `ios/…/LaunchScreen.storyboard` | `#FFFFFF` |
| `SPLASH.backgroundColor` (JS video splash) | `src/` — out of scope | white |

The `colors.xml` comment states the intent explicitly. There is a second, **JS-level** splash (a
video) after the native one — see `application/SPLASH.md` and `docs/IOS_SPLASH_VIDEO_SETUP.md`.

---

## 10. Bundler-generated image resources — DO NOT hand-copy

`android/app/src/main/res/drawable-*/` also contains PNGs that are **not** hand-authored assets —
the React Native bundler emits them when it processes `require()`d JS images:

```
drawable-mdpi/src_assets_images_iigrainlogo.png
drawable-mdpi/src_assets_images_iigrainlogoboth.png
drawable-mdpi/src_assets_images_splashimg.png
drawable-mdpi/src_assets_images_splashloader.png
drawable-mdpi/src_assets_images_splashlogoapp.png
drawable-mdpi/src_assets_images_splashlogor.png
drawable-{m,x,xx,xxx}hdpi/node_modules_reactnavigation_elements_lib_module_assets_backicon.png
drawable-mdpi/node_modules_reactnavigation_elements_lib_module_assets_backiconmask.png
drawable-{m,x,xx,xxx}hdpi/node_modules_reactnavigation_elements_lib_module_assets_clearicon.png
drawable-{m,x,xx,xxx}hdpi/node_modules_reactnavigation_elements_lib_module_assets_closeicon.png
drawable-{m,x,xx,xxx}hdpi/node_modules_reactnavigation_elements_lib_module_assets_searchicon.png
drawable-{m,x,xx,xxx}hdpi/node_modules_reactnavigation_drawer_lib_module_views_assets_toggledrawericon.png
```

Together with `res/raw/keep.xml`, which lists nine of them in a `tools:keep` attribute so the
resource shrinker cannot strip drawables that are only referenced from JavaScript.

> **Do not copy these, and do not copy `keep.xml`.** Both are **generated** — they regenerate on the
> first release build of the fresh project, from the `src/` images and the installed
> `@react-navigation/*` versions. Copying them stale risks resource names that no longer match what
> the new bundler emits, and a `keep.xml` referencing drawables that no longer exist.

Note: `src_assets_images_splashimg.png`, `…_splashlogoapp.png` and `…_splashlogor.png` exist as
drawables but are **not** in `keep.xml` — further evidence this directory is bundler output that
drifts, not curated assets.

---

## 11. Migration procedure for icons

### Android

1. Copy all **15** `res/mipmap-*/ic_launcher*.png` files (5 × `ic_launcher`, 5 × `ic_launcher_round`,
   5 × `ic_launcher_foreground`), replacing the RN template's default icons.
2. Copy both `res/mipmap-anydpi-v26/ic_launcher.xml` and `ic_launcher_round.xml`.
3. Add `ic_launcher_background` = `#FFFFFF` to `res/values/colors.xml`.
4. Confirm the manifest has `android:icon="@mipmap/ic_launcher"` and
   `android:roundIcon="@mipmap/ic_launcher_round"`.
5. Copy all **5** `res/drawable-*/splash_icon.png` files.
6. Add `splash_background` = `#FFFFFF` to `colors.xml`.
7. Add `Theme.App.SplashScreen` to `res/values/styles.xml` and apply it as `MainActivity`'s theme.
8. Add `androidx.core:core-splashscreen:1.0.1` and call `installSplashScreen()` first in
   `MainActivity.onCreate`.
9. **Add no notification icon** (preserves current behaviour).
10. **Do not** copy `keep.xml` or the `drawable-*/src_assets_*` / `node_modules_*` PNGs.

### iOS

1. Copy the entire `ios/iiGrain/Images.xcassets/AppIcon.appiconset/` directory — all **21** PNGs plus
   `Contents.json` — replacing the template's `AppIcon`.
2. Copy `ios/iiGrain/Images.xcassets/LeafLogo.imageset/` (`leaf.png` + `Contents.json`, with
   `template-rendering-intent: original`).
3. Copy `ios/iiGrain/Images.xcassets/Contents.json` (root catalogue file).
4. Copy `ios/iiGrain/LaunchScreen.storyboard`.
5. Confirm `Info.plist` → `UILaunchStoryboardName = LaunchScreen`.
6. Confirm `ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon` in **both** configs.
7. Confirm `LaunchScreen.storyboard` **and** `Images.xcassets` are both in the Resources build phase.
8. **Add no** alternate icons and no dark/tinted appearance variants.

### Shared

9. Copy `branding/splash_master.png` and `scripts/gen_splash_assets.py` so future rebranding stays
   single-source.

---

## 12. Verification checklist

### Android
- [ ] Launcher icon is the branded leaf on an API 26+ device (adaptive path)
- [ ] Launcher icon correct on an API 24/25 device (legacy raster path)
- [ ] Round-icon launcher shows the round variant
- [ ] Adaptive background renders white, not the template green
- [ ] Native splash shows the leaf centred on white before RN starts
- [ ] Splash → app transition shows **no colour flash**
- [ ] Notification small icon behaves as before (white silhouette from the launcher icon)
- [ ] All 15 `ic_launcher*` + 5 `splash_icon` files present in the AAB

### iOS
- [ ] Home-screen icon correct on iPhone (`@2x` / `@3x`)
- [ ] Home-screen icon correct on iPad
- [ ] Settings and Spotlight icons correct (29 pt / 40 pt)
- [ ] **TestFlight app list shows the correct icon** — proves the 1024 × 1024 marketing icon shipped
- [ ] Upload produced no missing-icon validation error
- [ ] Launch screen shows the leaf centred on white
- [ ] Leaf is **full colour**, not a flat tint (rendering intent preserved)

### Cross-platform
- [ ] Android native splash and iOS launch screen look **identical** — same leaf size (67 dp/pt),
      same white background, same centring. This is the intended, calibrated outcome; a visible
      difference means an asset was regenerated or a constraint changed.
