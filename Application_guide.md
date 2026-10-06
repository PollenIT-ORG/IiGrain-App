# Application Guide

This guide explains how to set up, run and build the React Native application, starting from a fresh computer.

> [!NOTE]
> **Project folder name:** in our repository the mobile project folder is called `iiGrain`, but it may have a different name (the application's name) when it is handed over. Wherever this guide says `<PROJECT_FOLDER>`, use the folder that contains `package.json`, `android/` and `ios/`.

## Contents

1. [Project Setup](#1-project-setup)
2. [Environment Setup](#2-environment-setup)
3. [Android Setup & Run](#3-android-setup--run)
4. [iOS Setup & Run](#4-ios-setup--run)
5. [Android Debug APK](#5-android-debug-apk)
6. [Android Release APK](#6-android-release-apk)
7. [Android Release AAB](#7-android-release-aab)
8. [iOS Release (TestFlight)](#8-ios-release-testflight)
9. [Google Maps Configuration](#9-google-maps-configuration)
10. [Third-Party Libraries](#10-third-party-libraries)
11. [Common Commands](#11-common-commands)
12. [Troubleshooting](#12-troubleshooting)
13. [Important Notes](#13-important-notes)

---

## 1. Project Setup

### Install the required software

| Software                     | Needed for      | Notes                                                                           |
| ---------------------------- | --------------- | ------------------------------------------------------------------------------- |
| Git                          | Android and iOS | To clone the project                                                            |
| Node.js **22.11.0 or newer** | Android and iOS | Check with `node -v`. npm is included                                           |
| JDK **17**                   | Android         | Check with `java -version`                                                      |
| Android Studio               | Android         | In *SDK Manager* install **Android SDK Platform 36** and **Build-Tools 36.0.0** |
| Xcode 15 or newer            | iOS             | Mac only                                                                        |
| CocoaPods, Ruby and Bundler  | iOS             | Mac only                                                                        |

Set the `ANDROID_HOME` environment variable to the Android SDK folder (Android Studio shows the path in *SDK Manager*):

- **Windows:** `C:\Users\<you>\AppData\Local\Android\Sdk`
- **macOS:** `~/Library/Android/sdk`

### Get the Project

The project is available on GitHub. Ask the project owner for repository access.

Clone the project:

```bash
git clone <GITHUB_REPOSITORY_URL>
```

Open the cloned project in your code editor.

> [!NOTE]
> The project folder name can be different depending on the application name.

### Install Dependencies

Open the terminal inside the React Native project folder (`<PROJECT_FOLDER>`) and run:

```bash
npm install
```

The project requires:

```text
Node.js >= 22.11.0
```

All commands in this guide are run from this folder unless a step says otherwise.

---

## 2. Environment Setup

The app reads its configuration from a `.env` file. The repository contains a template called `.env.example`. The real `.env` is private and is not committed to Git.

Create `.env` from `.env.example`.

### Windows — Command Prompt

```bash
copy .env.example .env
```

### Windows — PowerShell / macOS / Linux

```bash
cp .env.example .env
```

Open `.env` and add the required values:

```env
API_BASE_URL=
API_PREFIX=/api/v1
API_TIMEOUT=15000

MAPS_API_KEY_ANDROID=
MAPS_API_KEY_IOS=
```

| Variable               | What to put                                                                                                             |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `API_BASE_URL`         | Backend address, without a trailing slash and without `/api/v1`. **Provided by the backend developer.** Do not guess it |
| `API_PREFIX`           | Leave as `/api/v1` unless the backend developer says otherwise                                                          |
| `API_TIMEOUT`          | Request timeout in milliseconds. Leave as `15000`                                                                       |
| `MAPS_API_KEY_ANDROID` | Google Maps key for Android ([section 9](#9-google-maps-configuration))                                                 |
| `MAPS_API_KEY_IOS`     | Google Maps key for iOS ([section 9](#9-google-maps-configuration))                                                     |

> [!IMPORTANT]
> - Edit only `.env`. Never put real keys in `.env.example`, because that file is committed to Git.
> - Android reads the Maps key while Gradle builds, and iOS reads it when you run `pod install`. **After changing a Maps key, rebuild the app** (and re-run `pod install` on iOS). Reloading JavaScript is not enough.

`API_BASE_URL` will be provided by the backend developer.

Backend setup is handled separately by the backend team. You do **not** need to install, configure or run the backend or its database to work on the mobile app.

---

## 3. Android Setup & Run

Make sure Android Studio, Android SDK and JDK are installed and configured ([section 1](#1-project-setup)).

Connect an Android device or start an Android Emulator.

- **Physical phone:** enable *Developer options* and *USB debugging*, connect it with a USB cable and accept the prompt on the phone. Run `adb devices`. The phone must be listed as `device`.
- **Emulator:** create one in Android Studio's *Device Manager*. Choose a system image labelled **Google Play** or **Google APIs**. An AOSP image has no Google Play Services and the map stays grey.

**Step 1: Start Metro Bundler** (keep this terminal open):

```bash
npm start
```

**Step 2: Run the app on Android.** Open another terminal in the project folder and run:

```bash
npx react-native run-android
```

The application will build and open on the Android device/emulator. The first build takes several minutes.

To open the native project in Android Studio, choose *Open* and select the `android` folder inside `<PROJECT_FOLDER>`.

---

## 4. iOS Setup & Run

> [!IMPORTANT]
> iOS development requires a Mac with Xcode.

From the React Native project folder, install the iOS dependencies:

```bash
bundle install
```

Then install CocoaPods dependencies:

```bash
cd ios
bundle exec pod install
cd ..
```

Run `pod install` again after native dependencies change and after changing `MAPS_API_KEY_IOS`.

**Step 1: Start Metro Bundler** (keep this terminal open):

```bash
npm start
```

**Step 2: Run the app on iOS.** Open another terminal in the project folder and run:

```bash
npx react-native run-ios
```

The application will build and open in the iOS Simulator.

### Physical iPhone

The required Xcode signing and device configuration must be completed:

1. Open the `.xcworkspace` file inside the `ios` folder in Xcode (not the `.xcodeproj` file).
2. Select the app target and open *Signing & Capabilities*.
3. Choose your Apple Developer team.
4. Select your iPhone and press **Run**.

---

## 5. Android Debug APK

A debug APK is for internal testing. It can be copied to an Android phone and installed directly.

From the project root, generate the React Native bundle:

```bash
npx react-native bundle --platform android --dev false --entry-file index.js --bundle-output android/app/src/main/assets/index.android.bundle --assets-dest android/app/src/main/res
```

Without this step, a debug APK looks for Metro and shows a red error screen on a phone that is not connected to your computer.

Go to the Android folder:

```bash
cd android
```

### Windows — Command Prompt

```bash
gradlew assembleDebug
```

### Windows — PowerShell

```powershell
.\gradlew assembleDebug
```

### macOS / Linux

```bash
./gradlew assembleDebug
```

### APK Location

```text
<PROJECT_FOLDER>/android/app/build/outputs/apk/debug/app-debug.apk
```

---

## 6. Android Release APK

The release APK is the optimised build used for distribution.

> [!WARNING]
> **Current state of the project:** the release build is currently signed with the **debug keystore** (`android/app/debug.keystore`). That is fine for internal testing, but a build signed this way **cannot be published on the Play Store**. Create a real release keystore first ([6.1](#61-create-a-release-keystore)).

Go to the Android folder:

```bash
cd android
```

### Windows — Command Prompt

```bash
gradlew assembleRelease
```

### Windows — PowerShell

```powershell
.\gradlew assembleRelease
```

### macOS / Linux

```bash
./gradlew assembleRelease
```

Gradle bundles the JavaScript into the release build automatically, so the manual bundle command from section 5 is not needed here.

The release APK will be available in:

```text
<PROJECT_FOLDER>/android/app/build/outputs/apk/release/app-release.apk
```

### 6.1 Create a release keystore

Do this once, before publishing to the Play Store:

```bash
keytool -genkeypair -v -storetype PKCS12 -keystore my-release.keystore -alias my-key-alias -keyalg RSA -keysize 2048 -validity 10000
```

`keytool` asks for a password and some details. Then:

1. Move `my-release.keystore` into `android/app/`.
2. Add the credentials to your **user-level** Gradle file, not to the project (`~/.gradle/gradle.properties`, or `C:\Users\<you>\.gradle\gradle.properties` on Windows):

   ```properties
   MYAPP_UPLOAD_STORE_FILE=my-release.keystore
   MYAPP_UPLOAD_KEY_ALIAS=my-key-alias
   MYAPP_UPLOAD_STORE_PASSWORD=*****
   MYAPP_UPLOAD_KEY_PASSWORD=*****
   ```

3. In `android/app/build.gradle`, add a release signing config and use it for the release build type:

   ```groovy
   android {
       signingConfigs {
           release {
               if (project.hasProperty('MYAPP_UPLOAD_STORE_FILE')) {
                   storeFile file(MYAPP_UPLOAD_STORE_FILE)
                   storePassword MYAPP_UPLOAD_STORE_PASSWORD
                   keyAlias MYAPP_UPLOAD_KEY_ALIAS
                   keyPassword MYAPP_UPLOAD_KEY_PASSWORD
               }
           }
       }
       buildTypes {
           release {
               signingConfig signingConfigs.release
           }
       }
   }
   ```

   Keep the existing `debug` signing config as it is.

> [!CAUTION]
> **Back up the keystore file and its passwords in a safe place.** If they are lost, the app can never be updated on the Play Store. `*.keystore` files are already git-ignored; never commit them.

### 6.2 Add the release SHA-1 to the Maps key

A new keystore has a new SHA-1 fingerprint, and the Android Maps key only works for the fingerprints it lists. Print it with:

```bash
keytool -list -v -keystore android/app/my-release.keystore -alias my-key-alias
```

Copy the **SHA1** line and add it to the Android key's restrictions in Google Cloud ([section 9](#9-google-maps-configuration)). Otherwise the map is blank in the release build.

---

## 7. Android Release AAB

For Google Play Store publishing, create an Android App Bundle. It must be signed with your own release keystore ([6.1](#61-create-a-release-keystore)).

From the Android folder:

### Windows — Command Prompt

```bash
gradlew bundleRelease
```

### Windows — PowerShell

```powershell
.\gradlew bundleRelease
```

### macOS / Linux

```bash
./gradlew bundleRelease
```

The AAB will be available in:

```text
<PROJECT_FOLDER>/android/app/build/outputs/bundle/release/app-release.aab
```

Before every Play Store upload, increase `versionCode` (and update `versionName`) in `android/app/build.gradle`.

---

## 8. iOS Release (TestFlight)

> [!IMPORTANT]
> Mac with Xcode and an Apple Developer account with access to the app's team only.

Do the normal iOS setup first ([section 4](#4-ios-setup--run)), with `MAPS_API_KEY_IOS` set in `.env` **before** `pod install`.

### 8.1 Values that must not change

| Value                   | Setting                               | Why                                                                                                             |
| ----------------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `com.amitbaser.iigrain` | Bundle identifier (Debug and Release) | A different id creates a **new** App Store record. The existing app, its TestFlight groups and testers are lost |
| `SADMK33W84`            | Development team (Debug and Release)  | The wrong team cannot sign this bundle id. Changing it also signs out every existing install                    |

The iOS bundle id is **intentionally different** from the Android application id (`com.iigrain`). Do not "fix" this.

Signing is set to **Automatic**.

### 8.2 Bump the build number

In Xcode, select the app target and open *General* (or *Build Settings*):

| Setting                   | Meaning                | Current value |
| ------------------------- | ---------------------- | ------------- |
| `MARKETING_VERSION`       | Version shown to users | `2.0`         |
| `CURRENT_PROJECT_VERSION` | Build number           | `11`          |

Check App Store Connect for the highest build already uploaded for this version, and set `CURRENT_PROJECT_VERSION` above it. A duplicate build number is rejected only **after** the whole archive has finished.

`ITSAppUsesNonExemptEncryption` is already `false` in `Info.plist`. Keep it, otherwise every upload waits for a manual export-compliance answer.

### 8.3 Archive and upload

1. Open `ios/<APP_NAME>.xcworkspace` in Xcode. **Never** open the `.xcodeproj`, because it builds without the pods and fails.
2. Select the scheme and set the destination to **Any iOS Device (arm64)**.
3. Choose **Product → Archive**.
4. When the Organizer opens, choose **Distribute App → App Store Connect → Upload**.
5. In App Store Connect, open the app, go to **TestFlight** and wait for the build to finish processing. Then add it to a test group.

### 8.4 Things that look like breakage

- The first build after every `pod install` is slow (15 to 30 minutes). This is expected.
- If `MAPS_API_KEY_IOS` is missing, the build still succeeds, but the map silently falls back to Apple Maps instead of Google tiles. Check that Google tiles show in the TestFlight build.
- If you change `MAPS_API_KEY_IOS`, run `pod install` again. It regenerates `ios/Config/Env.generated.xcconfig`. That file is git-ignored; never edit or commit it.
- `Podfile.lock` is git-ignored, so `pod install` is always needed on a fresh clone.
- The camera, microphone, photo library and location permission texts are already in `Info.plist`. Keep them, because iOS rejects the app if a permission is used without its text.
- Minimum iOS version is **15.1**.

### 8.5 Test on a real iPhone before sending to testers

- Location off → starting a visit shows the prompt and links to Settings.
- Location permission **Allow Once** → backgrounding the app must not break a visit silently.
- **Precise Location** off → the arrival check must not wrongly reject someone standing in the field.
- Google tiles render (not Apple Maps).

### 8.6 Known limitations to tell testers

- Live visit tracking works only while the app is in the foreground. Background location is not implemented.
- The travelled trail resets if the app is killed in the middle of a visit.
- The arrival check warns but does not block, and cannot detect fake GPS.

---

## 9. Google Maps Configuration

The application uses separate Google Maps API keys for Android and iOS:

```env
MAPS_API_KEY_ANDROID=
MAPS_API_KEY_IOS=
```

| Platform | `.env` variable        | Key is restricted by                           |
| -------- | ---------------------- | ---------------------------------------------- |
| Android  | `MAPS_API_KEY_ANDROID` | Package name `com.iigrain` + SHA-1 fingerprint |
| iOS      | `MAPS_API_KEY_IOS`     | Bundle ID `com.amitbaser.iigrain`              |

The Android and iOS identifiers are different on purpose. Never use the Android key for iOS or the iOS key for Android.

### Open Google Maps Credentials

1. Open [Google Cloud Console](https://console.cloud.google.com/) with an account that has access to the project. Ask the project owner for access.
2. Select the **iigrain** project.
3. Go to:

   ```text
   APIs & Services → Credentials
   ```

Current project details:

```text
Project: iigrain
Project ID: golden-imprint-508407-d0
```

The project has separate keys:

```text
Android → android-map-key   (copy into MAPS_API_KEY_ANDROID)
iOS     → Ios-map-key       (copy into MAPS_API_KEY_IOS)
```

Click a key's name to see or change its restrictions, and use **Show key** to copy it. Use the correct key for the respective platform.

The Android key is restricted using the Android application details (package name and SHA-1), and the iOS key is restricted using the iOS Bundle ID.

### Requirements in Google Cloud

- **Billing** must be enabled on the project. Without it, maps stay blank.
- **Maps SDK for Android** and **Maps SDK for iOS** must be enabled under *APIs & Services → Library*.

### Debug SHA-1

Android debug builds are signed with `android/app/debug.keystore`. To print its SHA-1:

```bash
keytool -list -v -keystore android/app/debug.keystore -alias androiddebugkey -storepass android -keypass android
```

### Map is blank or grey?

Check these, in order:

1. The key is missing or wrong in `.env`.
2. The app was not rebuilt after changing the key.
3. Billing is off, or the Maps SDK for that platform is not enabled.
4. The SHA-1 (Android) or Bundle ID (iOS) is not in the key's restrictions.
5. On an emulator, the image has no Google Play Services.

---

## 10. Third-Party Libraries

Everything the app depends on is listed in `package.json`. The main libraries are:

| Area                   | Library                                                                                                                       |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Navigation             | React Navigation (native stack, bottom tabs, drawer)                                                                          |
| State                  | Redux Toolkit, React Redux, Redux Persist                                                                                     |
| Networking             | Axios, Socket.IO Client (real-time updates and visit tracking)                                                                |
| Maps and location      | React Native Maps (Google Maps), React Native Community Geolocation                                                           |
| Local storage          | AsyncStorage, op-sqlite (SQLite), React Native Keychain (secure storage)                                                      |
| Files and media        | React Native FS, Document Picker, Image Crop Picker, React Native Video, Clipboard                                            |
| Animation and gestures | Reanimated, Worklets, Gesture Handler, Lottie                                                                                 |
| UI                     | React Native SVG, Vector Icons, Linear Gradient, Gifted Charts, Safe Area Context, Screens, Keyboard Controller, Fast Shimmer |
| Inputs                 | DateTimePicker, International Phone Number, libphonenumber-js                                                                 |
| Device state           | NetInfo (online / offline)                                                                                                    |

The app does **not** use Firebase.

---

## 11. Common Commands

Run from `<PROJECT_FOLDER>`.

### Project

```bash
# Install JavaScript dependencies
npm install

# Start Metro Bundler (does not run the app)
npm start

# Run tests
npm test

# Check code style
npm run lint
```

### Run the app

Metro must already be running (`npm start`).

```bash
# Build and run on Android
npx react-native run-android

# Build and run on iOS (Mac only)
npx react-native run-ios
```

### Android device

```bash
# List connected Android devices
adb devices
```

---

## 12. Troubleshooting

| Problem                                             | What to try                                                                                                      |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `adb devices` shows nothing                         | Re-plug the cable, enable USB debugging, accept the prompt on the phone                                          |
| App opens but cannot reach the server               | Check `API_BASE_URL` in `.env` (ask the backend developer), then restart Metro with `npm start -- --reset-cache` |
| Red error screen on a debug APK                     | Run the bundle command from [section 5](#5-android-debug-apk) before `assembleDebug`                             |
| Map is blank or grey                                | See the checklist in [section 9](#9-google-maps-configuration)                                                   |
| Android build fails after an earlier failed attempt | In `android`, run `gradlew clean` (`./gradlew clean` on Mac), then build again                                   |
| iOS build fails after changing dependencies         | In `ios`, run `bundle exec pod install`, then build again                                                        |
| Changed `.env` but nothing changed                  | Rebuild the app. A JavaScript reload does not re-read native keys                                                |

---

## 13. Important Notes

- Keep `.env` and signing/keystore information private. Never commit them to Git.
- `API_BASE_URL` will be provided by the backend developer.
- Backend setup is handled by the backend team.
- Android builds can be created on Windows or macOS.
- iOS development/builds require a Mac with Xcode.
- Use the correct Google Maps key for Android and iOS.
- The current release build uses the debug keystore. Replace it with a real release keystore before publishing to the Play Store ([6.1](#61-create-a-release-keystore)).
- Keep this guide up to date whenever setup, build steps, API configuration, Maps keys or dependencies change.

### Reference

- [React Native Generate APK — Debug and Release APK](https://medium.com/geekculture/react-native-generate-apk-debug-and-release-apk-4e9981a2ea51)
- [React Native environment setup](https://reactnative.dev/docs/set-up-your-environment)
- [React Native: publishing to Google Play](https://reactnative.dev/docs/signed-apk-android)
- [Google Maps Platform documentation](https://developers.google.com/maps/documentation)
