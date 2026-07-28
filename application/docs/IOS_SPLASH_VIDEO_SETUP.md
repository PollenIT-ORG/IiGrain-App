# iOS Splash Video — Enablement Guide

The splash video is **already implemented in a platform-agnostic way**. Nothing
in `src/` is Android-specific, so enabling iOS is configuration only — there is
no new React code to write.

This document is written for the state of the repo where `application/ios/` does
not exist yet. Work top to bottom after running `npx react-native init`-style
project generation (or `npx @react-native-community/cli init` into a temp dir and
copying the `ios/` folder across).

---

## 0. What already works, and why

| Piece | File | Platform-specific? |
|---|---|---|
| Video playback | `src/components/splash/SplashVideo.tsx` | No |
| Splash screen | `src/screens/splash/SplashScreen.tsx` | No |
| Startup gate | `src/navigation/RootNavigator.tsx` | No |
| Colour / timing constants | `src/config/splash.ts` | No |
| Asset registry | `src/assets/video/index.ts` | No |

The video is loaded with `require('./splash_intro.mp4')`, which makes it a
**Metro asset**. Metro packages assets for iOS automatically through the
`Bundle React Native code and images` build phase.

> **Do not drag the `.mp4` into Xcode.** Adding it to *Copy Bundle Resources*
> would ship a second 2.4 MB copy that nothing reads. This is the single most
> common mistake when porting this setup.

---

## 1. Files to modify after `ios/` is created

| File | Change | Why |
|---|---|---|
| `ios/Podfile` | none (autolinked) | `react-native-video` ≥ 6 is autolinked |
| `ios/<App>/Info.plist` | portrait-only orientation keys | matches the Android manifest lock |
| `ios/<App>/LaunchScreen.storyboard` | background → `#FFFFFF` | removes the pre-JS colour flash |
| `ios/<App>.xcodeproj` | Deployment Target ≥ 13.0 | `react-native-video` v6 minimum |

No `AppDelegate` changes are required (see §6).

---

## 2. Pods

`react-native-video` 6.19.2 is autolinked — there is **no** manual `pod` line to
add.

```bash
cd ios
bundle install          # if the project uses a Gemfile (CocoaPods via Bundler)
bundle exec pod install  # or: pod install
```

Verify it linked:

```bash
grep -A2 "react-native-video" ios/Podfile.lock
```

---

## 3. Info.plist entries

Add portrait-only orientation so the decoder is never recreated by a rotation
(the same reasoning as `android:screenOrientation="portrait"`):

```xml
<key>UISupportedInterfaceOrientations</key>
<array>
    <string>UIInterfaceOrientationPortrait</string>
</array>
<key>UISupportedInterfaceOrientations~ipad</key>
<array>
    <string>UIInterfaceOrientationPortrait</string>
    <string>UIInterfaceOrientationPortraitUpsideDown</string>
</array>
```

To hide the status bar during the splash (the JS `<StatusBar hidden />` handles
this at runtime, but this removes the first-frame flicker):

```xml
<key>UIStatusBarHidden</key>
<true/>
<key>UIViewControllerBasedStatusBarAppearance</key>
<false/>
```

**Not required:** no `NSCameraUsageDescription`-style key is needed — playback of
a bundled file requests no permission. `NSAppTransportSecurity` is only relevant
if the splash ever streams from a remote URL.

---

## 4. Where the video lives

`src/assets/video/splash_intro.mp4` — unchanged, shared with Android.

Do **not** copy it into `ios/`. See the warning in §0.

The lowercase, space-free filename is an **Android** constraint (`res/raw`
resource names allow only `[a-z0-9_]`). iOS has no such rule, but keep the name
as-is so both platforms resolve the same asset.

---

## 5. Native configuration

| Setting | Value | Where |
|---|---|---|
| iOS Deployment Target | 13.0 or higher | Xcode → target → General |
| Launch screen background | `#FFFFFF` | `LaunchScreen.storyboard` |
| Orientation | Portrait only | Xcode → target → Deployment Info (mirrors §3) |

The launch-screen colour **must** equal `SPLASH.backgroundColor` in
`src/config/splash.ts`. If you change one, change the other, or a colour step
appears between the launch image and the video.

---

## 6. AppDelegate changes

**None.** `react-native-video` registers its own view manager through
autolinking. Do not add `AVFoundation` imports or audio-session code to
`AppDelegate` for this feature.

The one exception: if a future splash needs **audible** sound, you must
configure the audio session so it plays with the ringer switch silenced. Today
the video is muted (`muted` + `disableFocus` in `SplashVideo.tsx`), so this does
not apply.

---

## 7. AVFoundation

`react-native-video` links `AVFoundation` and `AVKit` itself via its podspec.
There is nothing to add to *Link Binary With Libraries*.

Relevant behaviour on iOS:

- `resizeMode="cover"` maps to `AVLayerVideoGravityResizeAspectFill` — fills the
  screen on every aspect ratio, no letterboxing.
- `onReadyForDisplay` maps to `AVPlayerLayer.isReadyForDisplay`, so the
  `firstFrameTimeoutMs` watchdog in `src/config/splash.ts` behaves identically.
- `muted` sets `AVPlayer.isMuted`, so the ringer switch is irrelevant.

---

## 8. react-native-video iOS setup

Version in use: **6.19.2** (`package.json`).

1. `pod install` (§2).
2. Confirm deployment target ≥ 13.0.
3. Nothing else — the props used by `SplashVideo.tsx` (`resizeMode`, `muted`,
   `repeat`, `controls`, `paused`, `playInBackground`, `disableFocus`,
   `preventsDisplaySleepDuringVideoPlayback`, `onReadyForDisplay`, `onEnd`,
   `onError`) are all supported on iOS in v6.

If you later enable ads/DRM/caching variants, they are opt-in subspecs — the
splash does not need them.

---

## 9. Release build considerations

- **Assets ship automatically.** The `Bundle React Native code and images` build
  phase runs Metro for Release configuration and copies `splash_intro.mp4` into
  the `.app`. No Xcode resource entry, no keep-file (iOS has no equivalent of
  Android's `shrinkResources`).
- **Bitcode:** not applicable (removed by Apple).
- **App thinning:** a bundled `.mp4` is not thinned away.
- **App size:** the video adds ~2.4 MB to the IPA. If that matters, re-encode
  before shipping — do it once, in `src/assets/video/`, so both platforms
  benefit.
- **Debug vs Release:** Debug loads the asset from Metro over HTTP; Release
  loads from the app bundle. Always smoke-test Release — a missing asset only
  shows up there. The `onError` path continues into the app rather than
  freezing, so a packaging mistake degrades gracefully instead of hanging.

---

## 10. Testing checklist

Run each on a **real device** (simulators mask decoder behaviour):

- [ ] Cold launch from a killed state — video plays from frame 0
- [ ] Video plays exactly once, never loops, never restarts
- [ ] No controls visible, no audio at any ringer position
- [ ] No white/black flash between launch screen → video → app
- [ ] Full-bleed with no bars on a notched phone (iPhone 14+) and on iPad
- [ ] Rotating the device during the splash does nothing (portrait lock)
- [ ] App opens the instant the video ends when startup already finished
- [ ] Slow network (Network Link Conditioner) → loader shows after the video,
      app opens when `bootstrapThunk` lands
- [ ] Airplane mode → still reaches the login/app screen (7 s bootstrap timeout)
- [ ] Corrupt the `.mp4` locally → app still starts (error path), warning logged
- [ ] Background the app mid-video, return → no crash, no restart loop
- [ ] Release build (`npx react-native run-ios --mode Release`) behaves as Debug
- [ ] Reinstall over an existing install — no stale-asset issues
- [ ] Instruments → Allocations: `AVPlayer` is released after the splash unmounts

---

## Cross-platform invariants

If you change any of these, change **both** platforms or the launch sequence
will visibly step:

| Concept | Android | iOS |
|---|---|---|
| Background colour | `styles.xml` → `android:windowBackground` | `LaunchScreen.storyboard` |
| Orientation lock | `AndroidManifest.xml` → `screenOrientation` | `Info.plist` → `UISupportedInterfaceOrientations` |
| Shared source of truth | `src/config/splash.ts` | `src/config/splash.ts` |
