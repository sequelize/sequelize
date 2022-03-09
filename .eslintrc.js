// eslint does not properly load plugins loaded by presets
// this fixes that
require('@rushstack/eslint-patch/modern-module-resolution');

module.exports = {
  extends: [
    '@ephys/eslint-config-typescript',
    '@ephys/eslint-config-typescript/node',
    '@ephys/eslint-config-typescript/commonjs',
  ],
  plugins: ['mocha', 'jsdoc'],
  rules: {
    'jsdoc/check-param-names': 'error',
    'jsdoc/check-tag-names': 'error',
    'jsdoc/check-types': 'off',
    'jsdoc/newline-after-description': 'error',
    'jsdoc/no-undefined-types': 'off',
    'jsdoc/require-description-complete-sentence': 'off',
    'jsdoc/require-example': 'off',
    'jsdoc/require-hyphen-before-param-description': 'off',
    'jsdoc/require-param': 'error',
    'jsdoc/require-param-description': 'off',
    'jsdoc/require-param-name': 'error',
    'jsdoc/require-param-type': 'off',
    'jsdoc/require-returns-description': 'off',
    'jsdoc/require-returns-type': 'off',
    'jsdoc/valid-types': 'error',
    'jsdoc/no-types': 'error',

    // We need to enable this in the next Major, it resolves a code smell
    'unicorn/custom-error-definition': 'off',

    // Enable this one if you want to prevent creating throwaway objects (perf)
    'unicorn/no-object-as-default-parameter': 'off',

    // sequelize needs to support node >= 12.
    // Object.hasOwn, Array#at, String#replaceAll are available in node >= 16.
    // `node:` protocol is available in node >= 14.
    'prefer-object-has-own': 'off',
    'unicorn/prefer-at': 'off',
    'unicorn/prefer-string-replace-all': 'off',
    'unicorn/prefer-node-protocol': 'off',

    // Too opinionated.
    'unicorn/prevent-abbreviations': 'off',
    'unicorn/prefer-switch': 'off',

    // This rule is incompatible with DataTypes
    'babel/new-cap': 'off',

    // Too slow for the scale of this codebase
    'import/no-deprecated': 'off',
    'import/named': 'off',
  },
  overrides: [{
    files: ['**/*.{js,mjs,cjs}'],
    rules: {
      'jsdoc/no-types': 'off',
      'jsdoc/require-param-type': 'error',
      'jsdoc/check-types': 'error',
      'jsdoc/require-returns-type': 'error',
    },
  }, {
    files: ['**/*.js'],
    rules: {
      // These rules have been disabled in .js files to ease adoption.
      // They'll be fixed during the TS migration.
      // Remove these once most files have been migrated to TS.

      // This will catch a lot of bugs with early-returns
      'consistent-return': 'off',

      // code smells that should be resolved
      'no-restricted-syntax': 'off',
      'no-await-in-loop': 'off',
      'unicorn/no-new-array': 'off',
      'no-restricted-globals': 'off',
      'default-case': 'off',
      'no-loop-func': 'off',
      'no-shadow': 'off',
      'no-unused-vars': 'off',
      'default-param-last': 'off',
      'unicorn/error-message': 'off',
      'no-implicit-coercion': 'off',
      'no-fallthrough': 'off',
      'babel/no-invalid-this': 'off',
      'prefer-rest-params': 'off',
      'no-loss-of-precision': 'off',

      // fromEntries is available in node 12. Restricted to v7.
      'unicorn/prefer-object-from-entries': 'off',

      // optimisation
      'unicorn/consistent-function-scoping': 'off',

      // array.reduce is difficult to reason about and can almost always
      // be replaced by a more explicit method
      'unicorn/no-array-reduce': 'off',
      'unicorn/no-array-for-each': 'off',
      'unicorn/prefer-spread': 'off',

      // makes code clearer
      'consistent-this': 'off',
      'unicorn/no-this-assignment': 'off',
      'unicorn/prefer-default-parameters': 'off',
      'max-statements-per-line': 'off',

      // makes debug easier
      'func-names': 'off',

      // multi-assigns can be difficult to understand
      // https://eslint.org/docs/rules/no-multi-assign
      'no-multi-assign': 'off',

      // GitHub's display length is 125 chars.
      // This enforces that length.
      'max-len': 'off',
      'max-depth': 'off',

      // Reduce diff noise.
      'import/order': 'off',

      // consistency
      'unicorn/filename-case': 'off',

      // This would reduce the amount of things to bundle by eg. webpack.
      'lodash/import-scope': 'off',

      // Passing a function reference to an array callback can accidentally introduce bug
      // due to array methods passing more than one parameter.
      'unicorn/no-array-callback-reference': 'off',
    },
  }, {
    // most tests are written in old JS style
    // let's disable the most problematic rules for now.
    // they're only disabled for .js files.
    // .ts files will need to migrate.
    files: ['test/**/*.js'],
    rules: {
      'babel/no-invalid-this': 'off',
      'func-names': 'off',
      'import/order': 'off',

      'no-invalid-this': 'off',
      'no-unused-expressions': 'off',
      camelcase: 'off',
      'no-console': 'off',
      'no-prototype-builtins': 'off',
      'no-multi-spaces': 'off',
    },
  }, {
    // Disable slow rules that are not important in tests & docs (perf)
    files: ['test/**/*', 'documentation/**/*'],
    rules: {
      'import/no-extraneous-dependencies': 'off',
      // no need to check jsdoc in tests & docs
      'jsdoc/check-types': 'off',
      'jsdoc/valid-types': 'off',
      'jsdoc/newline-after-description': 'off',
      'jsdoc/check-tag-names': 'off',
    },
  }, {
    files: ['documentation/**/_category_.json'],
    rules: {
      'unicorn/filename-case': 'off',
    },
  }, {
    files: ['documentation/**'],
    parserOptions: {
      project: ['./documentation/tsconfig.json'],
    },
  }, {
    // Enable test-specific rules (perf)
    files: ['test/**/*'],
    rules: {
      'mocha/no-exclusive-tests': 'error',
      'mocha/no-skipped-tests': 'warn',

      // it's fine if we're not very efficient in tests.
      'no-inner-declarations': 'off',
      'unicorn/no-unsafe-regex': 'off',

      // because of Chai
      '@typescript-eslint/no-unused-expressions': 'off',
    },
    env: {
      mocha: true,
    },
    parserOptions: {
      project: ['./test/tsconfig.json'],
    },
  }, {
    files: ['**/tsconfig.json'],
    rules: {
      'json/*': ['error', { allowComments: true }],
    },
  }],
  settings: {
    jsdoc: {
      tagNamePreference: {
        augments: 'extends',
      },
    },
  },
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'script',
  },
  // TODO: un-ignore test/types/**, src/**/*.d.ts, and 'dev/**/*'
  ignorePatterns: [
    'lib/**/*',
    'types/**/*',
    'test/types/**/*',
    'src/**/*.d.ts',
    'dev/**/*',
    '!dev/update-authors.js',
    'documentation/.docusaurus',
    'documentation/build',
    'documentation/node_modules',
    // typedoc (auto-generated)
    'documentation/static/api',
  ],
  env: {
    node: true,
    mocha: true,
    es6: true,
    es2020: true,
  },
};
