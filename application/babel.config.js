module.exports = function (api) {
  // Metro passes envName: 'production' as a Babel option for release bundles
  // (see @react-native/metro-babel-transformer), so api.env() is the reliable
  // signal here — reading process.env.BABEL_ENV directly is not.
  const isProduction = api.env('production');

  const plugins = [
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
  ];

  // Release bundles must not carry `console.*` calls — they leak auth tokens
  // and raw GPS coordinates into the device log. Pushed before the worklets
  // plugin so the ordering rule below still holds.
  if (isProduction) {
    plugins.push('transform-remove-console');
  }

  // reanimated/worklets plugin must stay last.
  plugins.push('react-native-worklets/plugin');

  return {
    presets: ['module:@react-native/babel-preset'],
    plugins,
  };
};
