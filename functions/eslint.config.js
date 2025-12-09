const {
  defineConfig,
} = require('eslint/config');

const globals = require('globals');
const js = require('@eslint/js');

const {
  FlatCompat,
} = require('@eslint/eslintrc');

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

module.exports = defineConfig([{
  languageOptions: {
    globals: {
      ...globals.node,
    },

    ecmaVersion: 2020,
    parserOptions: {},
  },

  extends: compat.extends('eslint:recommended', 'google'),

  rules: {
    'no-restricted-globals': ['error', 'name', 'length'],
    'prefer-arrow-callback': 'error',

    'quotes': ['error', 'single', {
      'allowTemplateLiterals': true,
    }],

    'max-len': ['error', {
      'code': 120,
      'ignoreUrls': true,
      'ignoreStrings': true,
    }],

    'valid-jsdoc': 'off',
    'require-jsdoc': 'off', // Règle supprimée dans ESLint 9

    'no-unused-vars': ['warn', {
      'argsIgnorePattern': '^_',
    }],
  },
}, {
  files: ['**/*.spec.*'],

  languageOptions: {
    globals: {
      ...globals.mocha,
    },
  },

  rules: {},
}]);


