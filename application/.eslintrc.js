module.exports = {
  root: true,
  extends: '@react-native',
  rules: {
    // Typography guardrail: the whole app must render text through AppText /
    // AppTextInput so the bundled Inter font (see src/constants/typography.ts)
    // is always applied. Importing react-native's raw Text / TextInput as a
    // *value* silently falls back to the system font, so ban it here.
    // Type-only imports (e.g. `forwardRef<TextInput>`) stay allowed.
    '@typescript-eslint/no-restricted-imports': [
      'error',
      {
        paths: [
          {
            name: 'react-native',
            importNames: ['Text', 'TextInput'],
            allowTypeImports: true,
            message:
              'Use AppText / AppTextInput instead of react-native Text / TextInput so the Inter app font is applied. For a type-only reference use `import { type Text }`.',
          },
        ],
      },
    ],
  },
  overrides: [
    {
      // The only two files allowed to wrap the raw RN primitives - every other
      // component/screen composes on top of these.
      files: [
        'src/components/AppText/AppText.tsx',
        'src/components/AppTextInput/AppTextInput.tsx',
      ],
      rules: {
        '@typescript-eslint/no-restricted-imports': 'off',
      },
    },
  ],
};
