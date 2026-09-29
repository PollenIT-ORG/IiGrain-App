# iiGrain: "Unable to find module dependency" in Xcode (README for an AI helper)

Give this file to ChatGPT or any assistant together with a screenshot of the Xcode error and the Xcode title bar.

## The problem

Xcode shows a wall of errors, and Product -> Archive fails:

- `Unable to find module dependency: 'CoreGraphics' / 'Dispatch' / 'Darwin' / 'ObjectiveC' / 'os' / '_DarwinFoundation1..3' ...` (system modules)
- In `AppDelegate.swift`: `'React'`, `'React_RCTAppDelegate'`, `'ReactAppDependencyProvider'`, `'GoogleMaps'`

It looks like a Google Maps error, but it is not one.

## Environment

- Path: `iiGrain/ios`. React Native 0.84.1, New Architecture, CocoaPods 1.16.2
- Xcode 26.2, macOS (Apple Silicon). Bundle id `com.amitbaser.iigrain`
- Google Maps comes from `pod 'react-native-maps/Google'` in `ios/Podfile`.
  The key is `MAPS_API_KEY_IOS` in `iiGrain/.env`. It goes through `ios/Config/Env.generated.xcconfig` into `Info.plist` (`GMSApiKey`) and is read in `AppDelegate.swift`.
- The Podfile sets `RCT_USE_PREBUILT_RNCORE=0` on purpose (React core builds from source, so the first build is slow). Do not remove it.

## Root cause (verified)

Xcode is opening `ios/iiGrain.xcodeproj` instead of `ios/iiGrain.xcworkspace`.
The bare `.xcodeproj` has no Pods integration (no React, GoogleMaps, codegen, xcconfig includes), so every module fails to resolve, including system modules.

Evidence:
- `xcodebuild -workspace iiGrain.xcworkspace -scheme iiGrain -configuration Release -destination "generic/platform=iOS" archive` gave `** ARCHIVE SUCCEEDED **` twice, including once after wiping all DerivedData.
- `npx react-native run-ios` (simulator) also works.
- DerivedData has two folders for the project. The `WorkspacePath` inside `info.plist` shows which file Xcode opened:
  - `iiGrain-aghqoibwepkxdqakkqfagezsmpjr` -> `.../ios/iiGrain.xcworkspace` (good)
  - `iiGrain-byrflvuscfgbecbetinmvwnffecw` -> `.../ios/iiGrain.xcodeproj` (bad, keeps coming back)
- Xcode reopens the `.xcodeproj` from Recent files or restored window state.

## Fix

1. Quit Xcode (Cmd+Q).
2. Clear stale state:
   ```bash
   rm -rf ~/Library/Developer/Xcode/DerivedData/iiGrain-*
   rm -rf ~/Library/Saved\ Application\ State/com.apple.dt.Xcode.savedState
   ```
3. In Finder, open `iiGrain/ios/` and double-click **iiGrain.xcworkspace**. Never open `iiGrain.xcodeproj`. Or run:
   ```bash
   open -a Xcode ios/iiGrain.xcworkspace
   ```
4. Check that the Xcode title bar / Project Navigator says `iiGrain.xcworkspace`.
5. Set the destination to **Any iOS Device (arm64)**, then Product -> Clean Build Folder, then Product -> Archive.

Check which file Xcode has open:
```bash
osascript -e 'tell application "Xcode" to get {name, path} of every workspace document'
```
It must print `.../iiGrain.xcworkspace`.

Check for a stale project-only cache:
```bash
for d in ~/Library/Developer/Xcode/DerivedData/iiGrain-*; do /usr/libexec/PlistBuddy -c "Print :WorkspacePath" "$d/info.plist"; done
```
Any line ending in `.xcodeproj` means it was opened wrongly.

## If it still fails from the workspace

Then it is a different problem. Ask for the FIRST red error in the Report navigator (Cmd+9 -> latest build), not the module cascade. Try these in order:

1. `cd ios && pod install` (Podfile.lock is in sync with the Podfile checksum, so this is rarely needed)
2. Signing: Xcode -> target iiGrain -> Signing & Capabilities -> pick the Team for Release
3. Make sure `iiGrain/.env` has `MAPS_API_KEY_IOS`. If it is missing, the build still succeeds but the map is blank.

## Unrelated issue: running on the physical iPhone

`xcodebuild` exit 70 with "developer disk image could not be mounted" is a device pairing problem, not a code problem. Unlock the phone, use USB, turn on Developer Mode, and check Xcode -> Window -> Devices and Simulators that it says Ready. To avoid the device attempt: `npx react-native run-ios --simulator="iPhone 17 Pro"`.
