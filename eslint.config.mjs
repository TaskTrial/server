import globals from 'globals';
import pluginJs from '@eslint/js';

/** @type {import('eslint').Linter.Config[]} */
export default [
  { languageOptions: { globals: globals.browser } },
  pluginJs.configs.recommended,
  {
    /**
     * "off" or 0 - turn the rule off
     * "warn" or 1 - turn the rule on as a warning (doesn’t affect exit code)
     * "error" or 2 - turn the rule on as an error (exit code is 1 when triggered)
     */
    ignores: ['**/*.config.js', '**/eslint.config.js'],
    rules: {
      semi: 'error',
      'no-unused-vars': 'warn',
      'no-console': 'warn',
      'no-const-assign': 'error',
      curly: 'warn',
      eqeqeq: 'error',
      'no-var': 'error',
      'prefer-const': 'error',
    },
  },
];
