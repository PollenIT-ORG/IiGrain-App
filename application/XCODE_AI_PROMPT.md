Paste everything below into Xcode's AI assistant.

---

I have a React Native 0.84.1 iOS app (CocoaPods, New Architecture, Google Maps via react-native-maps/Google) in `ios/`.

Symptom: Xcode shows "Unable to find module dependency" for system modules (CoreGraphics, Dispatch, Darwin, ObjectiveC, os, ...) and, in AppDelegate.swift, for React, React_RCTAppDelegate, ReactAppDependencyProvider and GoogleMaps. Product -> Archive fails.

What I already know:
- Command-line `xcodebuild -workspace iiGrain.xcworkspace -scheme iiGrain -configuration Release -destination "generic/platform=iOS" archive` succeeds. The code and Pods are fine.
- I suspect Xcode is opening `iiGrain.xcodeproj` (no Pods) instead of `iiGrain.xcworkspace`.

Please:
1. Tell me how to confirm which one is open right now (title bar, Project Navigator, File -> Workspace Settings).
2. Give exact steps to close it and reopen only `iiGrain.xcworkspace`, and to stop Xcode from reopening the `.xcodeproj` (Recent projects, restored windows, DerivedData).
3. If the workspace is already open and the errors remain, tell me how to find the FIRST real error in the Report navigator (not the module cascade) and what to check: scheme, destination "Any iOS Device (arm64)", Clean Build Folder, signing team for Release, Build Settings for Swift explicit modules.
4. Do not change React Native, Podfile, or GoogleMaps settings unless you find the real error first. `RCT_USE_PREBUILT_RNCORE=0` in the Podfile is intentional.

Give the shortest step-by-step fix.
