# Splash & App Icon - iiGrain

The brand mark is the **leaf only** - a flat, modern leaf in iiGrain green. **No
wordmark / no "iiGrain" text** is baked into the icon or the native splash. The
product name only appears inside the full-screen branded splash image
(`splashLoader.png`), which is a separate designed asset.

## Splash flow - three phases, one continuous picture

The user should see the leaf appear instantly and stay put for ~3 s, then
cross-fade into the branded artwork. There is **never** a white frame, and the
leaf **never** re-appears after the artwork has shown.

1. **Native splash = the leaf on white.** Painted by the OS at cold start,
   before React Native exists.
   - iOS: `LaunchScreen.storyboard` - a 160 pt aspect-fit image view showing the
     `LeafLogo` imageset, centered on white.
   - Android: `androidx.core:core-splashscreen`. `Theme.App.SplashScreen` is
     MainActivity's launch theme in `AndroidManifest.xml`
     (`windowSplashScreenAnimatedIcon` = `@drawable/splash_icon`,
     `windowSplashScreenBackground` = `@color/app_background`);
     `installSplashScreen()` in `MainActivity.kt` swaps to `AppTheme`.
     `setKeepOnScreenCondition` holds it until the RN root view has actually
     laid out a child (capped at 8 s) - **without that hold the OS drops the
     splash the moment the window is ready, which is the white flash.**
2. **JS leaf stage = `SplashBackdrop`** (`src/components/splash/`). A redraw of
   exactly the same leaf at exactly the same size, so the native → JS handover
   is invisible. Held for `SPLASH.logoMs` (3 s) counted from the first JS frame.
3. **Branded image splash = `src/assets/images/splashLoader.png`.** Rendered by
   `src/screens/splash/SplashScreen.tsx`, held for `SPLASH.holdMs` while
   session restore finishes. The loader bar filling releases it; the overlay
   then fades out once `bootstrapThunk` has settled (or `SPLASH.bootstrapTimeoutMs`
   elapses).

### One splash owner
`src/components/splash/SplashOverlay.tsx` runs all three phases. It is mounted
**once**, in `App.tsx`, as the last child of `<Provider>` and **outside**
`<PersistGate>`, and it is absolutely positioned over the whole app. It is the
only thing allowed to render splash artwork.

That rule exists because breaking it is what produced the
*white → splash → white → splash* bug: the splash used to be mounted twice -
once as PersistGate's `loading` view and again as a `Splash` route inside
`RootNavigator` - so rehydration tore the first copy down and mounted a fresh
copy of the same image, flashing white across the gap. `RootNavigator` now only
decides *auth vs app*; it has no splash route. Its `Booting` placeholder is
`SplashBackdrop` purely so a failure degrades to the leaf rather than to blank
white.

The branded artwork is mounted behind the leaf from the first frame so it is
already decoded when the cross-fade starts - a lazily-mounted `<Image>` is a
white frame.

There are **no other splash screens**, and **no splash library** -
`react-native-bootsplash` is *not* a dependency of this project. Anything
claiming otherwise is out of date.

### Why every startup frame is white
`SPLASH.backgroundColor` (`src/config/splash.ts`), the iOS storyboard
background, Android `AppTheme`'s `windowBackground` and
`windowSplashScreenBackground` are all white, and the top of
`splashLoader.png` is near-white. So there is never a blank or colour-shifting
frame - which is the only thing an OEM skin (MIUI/HyperOS) covers with its own
dark loading ring.

### Tuning the timings
All of it lives in `src/config/splash.ts`: `logoMs` (leaf stage), `holdMs`
(branded stage / loader bar), `fadeMs` (cross-fade and fade-out), `leafSize`
(must stay equal to `TARGET_LEAF_DP` in the generator), `bootstrapTimeoutMs`.

## Assets - where the leaf lives
| Purpose | iOS | Android |
|---|---|---|
| App icon (leaf) | `ios/iiGrain/Images.xcassets/AppIcon.appiconset` (21 sizes, **no alpha channel** - Apple rejects icons that carry one) | `mipmap-*/ic_launcher*`, `mipmap-anydpi-v26/ic_launcher.xml` |
| Native splash logo (leaf) | `Images.xcassets/LeafLogo.imageset` (used by `LaunchScreen.storyboard`) | `drawable-*/splash_icon.png` |
| JS leaf stage | `src/assets/images/splashLeaf.png` (bundled, shared) | same |
| Branded image splash | `src/assets/images/splashLoader.png` (bundled, shared) | same |

## Regenerating the splash logo

`scripts/gen_splash_assets.py` is the single source of truth: it renders the
iOS asset, the Android asset **and** the JS one from `branding/splash_master.png`
so the three can never drift. The leaf is `TARGET_LEAF_DP` (67) tall on screen
in all three - that identical size is what makes the handovers invisible.

```bash
python3 -m pip install pillow      # only dependency
python3 scripts/gen_splash_assets.py
```

It writes `LeafLogo.imageset/Contents.json` as well as `leaf.png`. **That
manifest is required** - an imageset without it is silently skipped by
`actool`, the asset never reaches `Assets.car`, and the iOS launch screen comes
up blank. (This is exactly what had happened: the manifest was missing and the
storyboard was still the stock React Native one, showing the text "iiGrain" and
"Powered by React Native" instead of the leaf.)

Verify a change without a full build:

```bash
xcrun ibtool --errors --warnings --notices --compile /tmp/ls.storyboardc \
  ios/iiGrain/LaunchScreen.storyboard
xcrun actool --app-icon AppIcon --output-partial-info-plist /tmp/p.plist \
  --target-device iphone --target-device ipad --minimum-deployment-target 15.1 \
  --platform iphoneos --compile /tmp/out ios/iiGrain/Images.xcassets
xcrun assetutil --info /tmp/out/Assets.car | grep '"Name"'   # expect AppIcon + LeafLogo
```

## Prompt to (re)generate the leaf mark - leaf only, no text
> A minimal, modern flat **leaf** logo mark for a regenerative-agriculture app
> called iiGrain. A single stylised leaf with a soft central vein highlight, in
> iiGrain greens (primary `#167A45`, light `#3FAE72`, highlight `#7DD8A5`), subtle
> depth. **No text, no wordmark, no letters** - the leaf only. Centered,
> transparent background, square canvas, crisp edges, app-icon quality. Export at
> 1024×1024 PNG (transparent) plus a white-background variant for the splash.

When regenerating: replace `branding/splash_master.png` and re-run the script
above; replace `ic_launcher_foreground` (Android) for the launcher icon. Keep
backgrounds **white** (`ic_launcher_background`, `splash_background` =
`#FFFFFF`).
