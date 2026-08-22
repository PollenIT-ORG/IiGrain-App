const esmPackages = [
  '(jest-)?react-native',
  '@react-native.*',
  '@react-navigation',
  'react-redux',
  'redux-persist',
  '@reduxjs/toolkit',
  'redux',
  'immer',
  'reselect',
  'react-native-.*',
  'gifted-charts-core',
  'libphonenumber-js',
];

module.exports = {
  preset: 'react-native',
  setupFiles: ['<rootDir>/jest.setup.js'],
  transformIgnorePatterns: [
    `node_modules/(?!(?:${esmPackages.join('|')})/)`,
  ],
};
