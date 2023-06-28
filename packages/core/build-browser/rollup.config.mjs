import commonjs from '@rollup/plugin-commonjs';
import inject from '@rollup/plugin-inject';
import json from '@rollup/plugin-json';
import nodeResolve from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';
import terser from '@rollup/plugin-terser';

function getConfig({ minify }) {
  return {
    // Builds a "bundle" from the output of `npm run build` command.
    input: './build-browser/index.js',

    plugins: [
      // Allows `require()`-ing "*.json" files.
      json(),

      // Adds support for `require()`ing CommonJS modules/packages.
      // By default, Rollup only understands ES6 ones.
      commonjs(),

      // Resolves `require()`s of packages from `node_modules`.
      nodeResolve({
        browser: true,
      }),

      // Replace 'node:crypto' module with a "shim".
      replace({
        include: [
          // `require()`s.
          './packages/core/src/dialects/abstract/query.js',
          './packages/core/src/dialects/abstract/query-generator.js',
          './packages/core/src/dialects/mssql/query-generator.js',
          './packages/core/src/dialects/db2/query-generator.js',
          // `import`s.
          './packages/core/src/utils/dialect.ts',
          './packages/core/src/dialects/sqlite/query-generator-typescript.ts',
        ],
        values: {
          crypto: JSON.stringify('.../../../build-browser/shims/crypto/index.js'),
          'node:crypto': JSON.stringify('.../../../build-browser/shims/crypto/index.js'),
        },
        delimiters: ['require(\'', '\')'],
        // Doesn't skip replacing the left part of an assignment to such variable.
        // https://www.npmjs.com/package/@rollup/plugin-replace#user-content-preventassignment
        preventAssignment: false,
      }),

      // Replace 'node:util' module with a "shim".
      replace({
        include: [
          // `require()`s.
          './packages/core/src/dialects/abstract/query-generator.js',
          './packages/core/src/dialects/ibmi/query-generator.js',
          './packages/core/src/model.js',
          './packages/core/src/instance-validator.js',
          // `import`s.
          './packages/core/src/geo-json.ts',
          './packages/core/src/dialects/sqlite/connection-manager.ts',
          './packages/core/src/model-definition.ts',
          './packages/core/src/model-internals.ts',
          './packages/core/src/associations/helpers.ts',
          './packages/core/src/decorators/legacy/associations.ts',
          './packages/core/src/dialects/abstract/data-types-utils.ts',
          './packages/core/src/dialects/abstract/data-types.ts',
          './packages/core/src/dialects/abstract/query-generator-typescript.ts',
          './packages/core/src/dialects/abstract/query-generator.js',
          './packages/core/src/dialects/abstract/query.js',
          './packages/core/src/dialects/abstract/where-sql-builder.ts',
          './packages/core/src/dialects/abstract/where-sql-builder.ts',
          './packages/core/src/utils/deprecations.ts',
          './packages/core/src/utils/dialect.ts',
          './packages/core/src/utils/immutability.ts',
          './packages/core/src/utils/logger.ts',
          './packages/core/src/utils/string.ts',
          './packages/core/src/dialects/sqlite/data-types.ts',
          './packages/core/src/dialects/sqlite/connection-manager.ts',
        ],
        values: {
          'node:util': JSON.stringify('.../../../build-browser/shims/util/index.js'),
        },
        delimiters: ['require(\'', '\')'],
        // Doesn't skip replacing the left part of an assignment to such variable.
        // https://www.npmjs.com/package/@rollup/plugin-replace#user-content-preventassignment
        preventAssignment: false,
      }),

      // Replace 'node:buffer' module with a "shim".
      replace({
        include: [
          // `import`s.
          './packages/core/src/dialects/abstract/data-types.ts',
        ],
        values: {
          'node:buffer': JSON.stringify('.../../../build-browser/shims/buffer/index.js'),
        },
        delimiters: ['require(\'', '\')'],
        // Doesn't skip replacing the left part of an assignment to such variable.
        // https://www.npmjs.com/package/@rollup/plugin-replace#user-content-preventassignment
        preventAssignment: false,
      }),

      // Replace 'node:assert' module with a "shim".
      replace({
        include: [
          // `require()`s.
          './packages/core/src/model.js',
          // `import`s.
          './packages/core/src/transaction.ts',
          './packages/core/src/associations/belongs-to.ts',
          './packages/core/src/associations/helpers.ts',
          './packages/core/src/dialects/abstract/query-interface-internal.ts',
          './packages/core/src/dialects/abstract/query-interface-typescript.ts',
          './packages/core/src/utils/format.ts',
        ],
        values: {
          'node:assert': JSON.stringify('.../../../build-browser/shims/assert/index.js'),
        },
        delimiters: ['require(\'', '\')'],
        // Doesn't skip replacing the left part of an assignment to such variable.
        // https://www.npmjs.com/package/@rollup/plugin-replace#user-content-preventassignment
        preventAssignment: false,
      }),

      // Replace 'node:url' module with a "shim".
      replace({
        include: [
          // `import`s.
          './packages/core/src/dialects/sqlite/connection-manager.ts',
        ],
        values: {
          'node:url': JSON.stringify('.../../../build-browser/shims/url/index.js'),
        },
        delimiters: ['require(\'', '\')'],
        // Doesn't skip replacing the left part of an assignment to such variable.
        // https://www.npmjs.com/package/@rollup/plugin-replace#user-content-preventassignment
        preventAssignment: false,
      }),

      // Replace 'node:fs' module with a "shim".
      replace({
        include: [
          // `import`s.
          './packages/core/src/dialects/sqlite/connection-manager.ts',
        ],
        values: {
          'node:fs': JSON.stringify('.../../../build-browser/shims/fs/index.js'),
        },
        delimiters: ['require(\'', '\')'],
        // Doesn't skip replacing the left part of an assignment to such variable.
        // https://www.npmjs.com/package/@rollup/plugin-replace#user-content-preventassignment
        preventAssignment: false,
      }),

      // Replace 'node:path' module with a "shim".
      replace({
        include: [
          // `import`s.
          './packages/core/src/dialects/sqlite/connection-manager.ts',
        ],
        values: {
          'node:path': JSON.stringify('.../../../build-browser/shims/path/index.js'),
        },
        delimiters: ['require(\'', '\')'],
        // Doesn't skip replacing the left part of an assignment to such variable.
        // https://www.npmjs.com/package/@rollup/plugin-replace#user-content-preventassignment
        preventAssignment: false,
      }),

      // Replace 'node:async_hooks' module with a "shim".
      replace({
        include: [
          // `import`s.
          './packages/core/src/sequelize-typescript.ts',
        ],
        values: {
          'node:async_hooks': JSON.stringify('.../../../build-browser/shims/async_hooks/index.js'),
        },
        delimiters: ['require(\'', '\')'],
        // Doesn't skip replacing the left part of an assignment to such variable.
        // https://www.npmjs.com/package/@rollup/plugin-replace#user-content-preventassignment
        preventAssignment: false,
      }),

      // Replace 'fast-glob' module with a "shim".
      replace({
        include: [
          // `import`s.
          './packages/core/src/import-models.ts',
        ],
        values: {
          'fast-glob': JSON.stringify('.../../../build-browser/shims/fast-glob/index.js'),
        },
        delimiters: ['require(\'', '\')'],
        // Doesn't skip replacing the left part of an assignment to such variable.
        // https://www.npmjs.com/package/@rollup/plugin-replace#user-content-preventassignment
        preventAssignment: false,
      }),

      // Replace `Buffer` and `process` global variables with web browser "polyfills".
      inject({
        sourceMap: true,
        modules: {
          process: 'process',
          Buffer: ['buffer', 'Buffer'],
        },
      }),

      // Use "Terser" to minify the output.
      ...(minify ? [terser()] : []),
    ],

    output: {
      format: 'umd',
      name: 'Sequelize',
      file: `build-browser/sequelize${minify ? '.min' : ''}.js`,
      sourcemap: true,
    },
  };
}

export default [
  getConfig({ minify: false }),
  // getConfig({ minify: true }),
];
