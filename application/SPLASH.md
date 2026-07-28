# Splash & App Icon - iiGrain

The brand mark is the **leaf only** - a flat, modern leaf in iiGrain green. **No
wordmark / no "iiGrain" text** is baked into the icon or the native splash. The
product name only appears inside the full-screen branded splash image
(`splashLoader.png`), which is a separate designed asset.

## Splash flow (both platforms) - exactly two, in order

1. **Native splash = the leaf on white.** Shown instantly by the OS at cold
   start, before React Native exists.
   - iOS: `LaunchScreen.storyboard` - a 160 pt aspect-fit image view showing the
     `LeafLogo` imageset, centered on a white background.
   - Android: `androidx.core` SplashScreen API. `Theme.App.SplashScreen` is
     MainActivity's launch theme (`windowSplashScreenAnimatedIcon` =
     `@drawable/splash_icon`, `windowSplashScreenBackground` = `#FFFFFF`);
     `installSplashScreen()` in `MainActivity.kt` swaps to `AppTheme` once RN is
     ready.
2. **Branded image splash = `src/assets/images/splashLoader.png`.** The
   full-screen JS `SplashScreen` (`src/screens/splash/SplashScreen.tsx`), held
   for `SPLASH.holdMs` while session-restore finishes. The loader bar filling is
   what releases it.

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

## Assets - where the leaf lives
| Purpose | iOS | Android |
|---|---|---|
| App icon (leaf) | `ios/iiGrain/Images.xcassets/AppIcon.appiconset` (21 sizes, **no alpha channel** - Apple rejects icons that carry one) | `mipmap-*/ic_launcher*`, `mipmap-anydpi-v26/ic_launcher.xml` |
| Native splash logo (leaf) | `Images.xcassets/LeafLogo.imageset` (used by `LaunchScreen.storyboard`) | `drawable-*/splash_icon.png` |
| Branded image splash | `src/assets/images/splashLoader.png` (bundled, shared) | same |

## Regenerating the native splash logo

`scripts/gen_splash_assets.py` is the single source of truth: it renders both
platforms' native splash logo from `branding/splash_master.png` so they can
never drift. The leaf is `TARGET_LEAF_DP` (67) tall on screen on both.

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
