import { basePreset, nodeAddon } from '@ephys/eslint-config-typescript';
import { fixupPluginRules } from '@eslint/compat';
import jsdoc from 'eslint-plugin-jsdoc';
import mocha from 'eslint-plugin-mocha';
import globals from 'globals';

// These plugins (pulled in by @ephys/eslint-config) still use rule context APIs
// that were removed in ESLint 10, so their rules are wrapped with @eslint/compat.
const legacyPlugins = new Set(['import', 'json', 'lodash', 'sort-destructure-keys']);

const ephysPreset = basePreset(import.meta.dirname).map(config => {
  if (!config.plugins) {
    return config;
  }

  return {
    ...config,
    plugins: Object.fromEntries(
      Object.entries(config.plugins).map(([name, plugin]) => [
        name,
        legacyPlugins.has(name) ? fixupPluginRules(plugin) : plugin,
      ]),
    ),
  };
});

export default [
  {
    ignores: [
      'packages/*/lib/**/*',
      'packages/*/types/**/*',
      'packages/**/skeletons/**/*',
      '.typedoc-build/**/*',
      '.nx/**/*',
      'packages/cli/migrations/**/*',
      'packages/cli/seeds/**/*',
    ],
  },
  ...ephysPreset,
  ...nodeAddon,
  {
    plugins: {
      mocha,
      jsdoc,
    },
    languageOptions: {
      // @ephys/eslint-config defaults to 2021, which cannot parse top-level await or private class fields
      ecmaVersion: 'latest',
      globals: {
        ...globals.mocha,
      },
    },
    rules: {
      'jsdoc/check-param-names': 'error',
      'jsdoc/check-tag-names': 'error',
      'jsdoc/check-types': 'off',
      'jsdoc/tag-lines': ['error', 'any', { startLines: 1 }],
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

      'no-restricted-globals': [
        'error',
        {
          name: 'AggregateError',
          message:
            'Import AggregateError from @sequelize/core. The global AggregateError is a different class.',
        },
      ],

      // TODO: enable in follow-up PR. Requires the utils package.
      'no-restricted-syntax': 'off',
      'no-restricted-imports': 'off',
      '@typescript-eslint/no-restricted-types': 'off',
      // TODO: enable in follow-up PR. Requires enabling TSC's noUncheckedIndexedAccess
      '@typescript-eslint/no-unnecessary-condition': 'off',
      // TODO: enable in follow-up PR. Requires manual code changes.
      '@typescript-eslint/naming-convention': 'off',
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/member-ordering': 'off',
      'unicorn/no-object-as-default-parameter': 'off',
      '@typescript-eslint/prefer-optional-chain': 'off',
      'logical-assignment-operators': 'off',
      // TODO: enable in a follow-up PR (4 findings in model-definition.ts).
      // ESLint 10 fixed a bug that made max-depth undercount blocks nested inside else-if chains.
      'max-depth': 'off',
    },
    settings: {
      jsdoc: {
        tagNamePreference: {
          augments: 'extends',
        },
        structuredTags: {
          typeParam: {
            type: false,
            required: ['name'],
          },
          category: {
            type: false,
            required: ['name'],
          },
          internal: {
            type: false,
          },
          hidden: {
            type: false,
          },
        },
      },
    },
  },
  {
    // Most of the code base is still CommonJS.
    // This replaces the '@ephys/eslint-config-typescript/commonjs' preset that was removed in v21.
    files: ['**/*.js', '**/*.ts'],
    rules: {
      'unicorn/prefer-top-level-await': 'off',
      'unicorn/prefer-module': 'off',
      'import/no-commonjs': 'off',
    },
  },
  {
    files: ['**/*.ts'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',

      // typescript-eslint v8 stopped treating a `default` clause as exhaustive for union types.
      // Keep the previous behavior, which is what the codebase was written against.
      '@typescript-eslint/switch-exhaustiveness-check': [
        'error',
        { considerDefaultExhaustiveForUnions: true },
      ],
    },
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    rules: {
      'jsdoc/no-types': 'off',
      'jsdoc/require-param-type': 'error',
      'jsdoc/check-types': 'error',
      'jsdoc/require-returns-type': 'error',
    },
  },
  {
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
      'default-case': 'off',
      'no-loop-func': 'off',
      'no-shadow': 'off',
      'default-param-last': 'off',
      'no-fallthrough': 'off',
      'prefer-rest-params': 'off',
      'no-loss-of-precision': 'off',

      // optimisation
      'unicorn/consistent-function-scoping': 'off',

      // array.reduce is difficult to reason about and can almost always
      // be replaced by a more explicit method
      'unicorn/no-array-reduce': 'off',
      'unicorn/no-array-for-each': 'off',
      'unicorn/prefer-spread': 'off',

      // makes code clearer
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

      // Passing a function reference to an array callback can accidentally introduce bug
      // due to array methods passing more than one parameter.
      'unicorn/no-array-callback-reference': 'off',
    },
  },
  {
    // most tests are written in old JS style
    // let's disable the most problematic rules for now.
    // they're only disabled for .js files.
    // .ts files will need to migrate.
    files: ['packages/*/test/**/*.js'],
    rules: {
      'func-names': 'off',
      'import/order': 'off',

      'consistent-this': 'off',
      'no-invalid-this': 'off',
      'unicorn/no-this-assignment': 'off',
      'no-unused-expressions': 'off',
      camelcase: 'off',
      'no-console': 'off',
      'no-prototype-builtins': 'off',
      'no-multi-spaces': 'off',
      'unicorn/error-message': 'off',
    },
  },
  {
    // Disable slow rules that are not important in tests (perf)
    files: ['packages/*/test/**/*', '**/*.test.{ts,js}'],
    languageOptions: {
      globals: {
        ...globals.mocha,
      },
    },
    rules: {
      'import/no-extraneous-dependencies': 'off',
      // no need to check jsdoc in tests & docs
      'jsdoc/check-types': 'off',
      'jsdoc/valid-types': 'off',
      'jsdoc/tag-lines': 'off',
      'jsdoc/check-tag-names': 'off',

      // Enable test-specific rules (perf)
      'mocha/no-exclusive-tests': 'error',
      'mocha/no-pending-tests': 'warn',

      // it's fine if we're not very efficient in tests.
      'no-inner-declarations': 'off',

      // because of Chai
      '@typescript-eslint/no-unused-expressions': 'off',

      // Allow regular functions (needed for this.timeout() in Mocha describe blocks)
      'func-names': 'off',
      '@typescript-eslint/no-invalid-this': 'off',
    },
  },
  {
    files: ['packages/*/test/types/**/*'],
    rules: {
      // This code is never executed, it's typing only, so these rules make no sense:
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      'no-console': 'off',
    },
  },
  {
    files: ['**/tsconfig.json'],
    rules: {
      'json/*': ['error', { allowComments: true }],
    },
  },
  {
    files: ['sscce.ts'],
    rules: {
      'no-console': 'off',
      // sscce.ts imports workspace packages that are not listed in the root package.json
      'import/no-extraneous-dependencies': 'off',
    },
  },
  {
    files: ['eslint.config.mjs'],
    rules: {
      'import/no-default-export': 'off',
    },
  },
];
