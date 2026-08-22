module.exports = function (api) {
  const isProduction = api.env('production');

  const plugins = [
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

  if (isProduction) {
    plugins.push('transform-remove-console');
  }

  plugins.push('react-native-worklets/plugin');

  return {
    presets: ['module:@react-native/babel-preset'],
    plugins,
  };
};
