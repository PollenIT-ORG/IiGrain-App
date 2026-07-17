/**
 * react-native.config.js - links the bundled Inter fonts into the native apps.
 *
 * Run `npx react-native-asset` after changing this file to copy the fonts into
 * the Android + iOS projects (iOS: adds them to Info.plist UIAppFonts + the
 * "Copy Bundle Resources" build phase; Android: copies to
 * android/app/src/main/assets/fonts). Then rebuild (pod install / gradle).
 */
module.exports = {
  project: {
    ios: {},
    android: {},
  },
  assets: ['./src/assets/fonts'],
};
