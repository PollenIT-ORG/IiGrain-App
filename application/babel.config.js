module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    // Loads `.env` and exposes vars via the `@env` module (see src/config/env.ts).
    [
      'module:react-native-dotenv',
      {
        moduleName: '@env',
        path: '.env',
        safe: false,
        allowUndefined: true,
      },
    ],
    // reanimated/worklets plugin must stay last.
    'react-native-worklets/plugin',
  ],
};
