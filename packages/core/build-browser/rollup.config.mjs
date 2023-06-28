import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import nodeResolve from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';
import terser from '@rollup/plugin-terser';

function getConfig({ minify }) {
  return {
    // Uses the output of `npm run build` command.
    input: './lib/index.js',

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
          './packages/core/src/dialects/abstract/query.js',
          './packages/core/src/dialects/abstract/query-generator.js',
          './packages/core/src/dialects/mssql/query-generator.js',
          './packages/core/src/dialects/db2/query-generator.js',
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
          './packages/core/src/dialects/abstract/query-generator.js',
          './packages/core/src/dialects/ibmi/query-generator.js',
          './packages/core/src/dialects/sqlite/connection-manager.ts',
          './packages/core/src/model.js',
          './packages/core/src/instance-validator.js',
        ],
        values: {
          'node:util': JSON.stringify('.../../../build-browser/shims/util/index.js'),
        },
        delimiters: ['require(\'', '\')'],
        // Doesn't skip replacing the left part of an assignment to such variable.
        // https://www.npmjs.com/package/@rollup/plugin-replace#user-content-preventassignment
        preventAssignment: false,
      }),

      // Replace 'node:assert' module with a "shim".
      replace({
        include: [
          './packages/core/src/model.js',
        ],
        values: {
          'node:assert': JSON.stringify('.../../../build-browser/shims/assert/index.js'),
        },
        delimiters: ['require(\'', '\')'],
        // Doesn't skip replacing the left part of an assignment to such variable.
        // https://www.npmjs.com/package/@rollup/plugin-replace#user-content-preventassignment
        preventAssignment: false,
      }),

      // Replace 'node:fs' module with a "shim".
      replace({
        include: [
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
];
