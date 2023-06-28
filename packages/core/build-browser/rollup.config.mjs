import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import commonjs from '@rollup/plugin-commonjs';
import inject from '@rollup/plugin-inject';
import json from '@rollup/plugin-json';
import nodeResolve from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';
import terser from '@rollup/plugin-terser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function getConfig({ minify }) {
  return {
    // Builds a "bundle" from the output of `npm run build` command.
    input: './build-browser/index.js',

    plugins: [
      // Replace 'node:crypto' module with a "shim".
      replace({
        include: getFilePathsInLib([
          // `require()`s.
          './src/dialects/abstract/query.js',
          './src/dialects/abstract/query-generator.js',
          './src/dialects/mssql/query-generator.js',
          './src/dialects/db2/query-generator.js',
          // `import`s.
          './src/utils/dialect.ts',
          './src/dialects/sqlite/query-generator-typescript.ts',
        ]),
        values: {
          crypto: getShimRequireReplacement('crypto'),
          'node:crypto': getShimRequireReplacement('crypto'),
        },
        delimiters: ['require\\("', '"\\)'],
        // Doesn't skip replacing the left part of an assignment to such variable.
        // https://www.npmjs.com/package/@rollup/plugin-replace#user-content-preventassignment
        preventAssignment: false,
      }),

      // Replace 'node:util' module with a "shim".
      replace({
        include: getFilePathsInLib([
          // `require()`s.
          './src/dialects/abstract/query-generator.js',
          './src/dialects/ibmi/query-generator.js',
          './src/model.js',
          './src/instance-validator.js',
          // `import`s.
          './src/geo-json.ts',
          './src/dialects/sqlite/connection-manager.ts',
          './src/model-definition.ts',
          './src/model-internals.ts',
          './src/associations/helpers.ts',
          './src/decorators/legacy/associations.ts',
          './src/dialects/abstract/data-types-utils.ts',
          './src/dialects/abstract/data-types.ts',
          './src/dialects/abstract/query-generator-typescript.ts',
          './src/dialects/abstract/query-generator.js',
          './src/dialects/abstract/query.js',
          './src/dialects/abstract/where-sql-builder.ts',
          './src/dialects/abstract/where-sql-builder.ts',
          './src/utils/deprecations.ts',
          './src/utils/dialect.ts',
          './src/utils/immutability.ts',
          './src/utils/logger.ts',
          './src/utils/string.ts',
          './src/dialects/sqlite/data-types.ts',
          './src/dialects/sqlite/connection-manager.ts',
        ]),
        values: {
          'node:util': getShimRequireReplacement('util'),
        },
        delimiters: ['require\\("', '"\\)'],
        // Doesn't skip replacing the left part of an assignment to such variable.
        // https://www.npmjs.com/package/@rollup/plugin-replace#user-content-preventassignment
        preventAssignment: false,
      }),

      // Replace 'node:buffer' module with a "shim".
      replace({
        include: getFilePathsInLib([
          // `import`s.
          './src/dialects/abstract/data-types.ts',
        ]),
        values: {
          'node:buffer': getShimRequireReplacement('buffer'),
        },
        delimiters: ['require\\("', '"\\)'],
        // Doesn't skip replacing the left part of an assignment to such variable.
        // https://www.npmjs.com/package/@rollup/plugin-replace#user-content-preventassignment
        preventAssignment: false,
      }),

      // Replace 'node:assert' module with a "shim".
      replace({
        include: getFilePathsInLib([
          // `require()`s.
          './src/model.js',
          // `import`s.
          './src/transaction.ts',
          './src/associations/belongs-to.ts',
          './src/associations/helpers.ts',
          './src/dialects/abstract/query-interface-internal.ts',
          './src/dialects/abstract/query-interface-typescript.ts',
          './src/utils/format.ts',
        ]),
        values: {
          'node:assert': getShimRequireReplacement('assert'),
        },
        delimiters: ['require\\("', '"\\)'],
        // Doesn't skip replacing the left part of an assignment to such variable.
        // https://www.npmjs.com/package/@rollup/plugin-replace#user-content-preventassignment
        preventAssignment: false,
      }),

      // Replace 'node:url' module with a "shim".
      replace({
        include: getFilePathsInLib([
          // `import`s.
          './src/dialects/sqlite/connection-manager.ts',
        ]),
        values: {
          'node:url': getShimRequireReplacement('url'),
        },
        delimiters: ['require\\("', '"\\)'],
        // Doesn't skip replacing the left part of an assignment to such variable.
        // https://www.npmjs.com/package/@rollup/plugin-replace#user-content-preventassignment
        preventAssignment: false,
      }),

      // Replace 'node:fs' module with a "shim".
      replace({
        include: getFilePathsInLib([
          // `import`s.
          './src/dialects/sqlite/connection-manager.ts',
        ]),
        values: {
          'node:fs': getShimRequireReplacement('fs'),
        },
        delimiters: ['require\\("', '"\\)'],
        // Doesn't skip replacing the left part of an assignment to such variable.
        // https://www.npmjs.com/package/@rollup/plugin-replace#user-content-preventassignment
        preventAssignment: false,
      }),

      // Replace 'node:path' module with a "shim".
      replace({
        include: getFilePathsInLib([
          // `import`s.
          './src/dialects/sqlite/connection-manager.ts',
        ]),
        values: {
          'node:path': getShimRequireReplacement('path'),
        },
        delimiters: ['require\\("', '"\\)'],
        // Doesn't skip replacing the left part of an assignment to such variable.
        // https://www.npmjs.com/package/@rollup/plugin-replace#user-content-preventassignment
        preventAssignment: false,
      }),

      // Replace 'node:async_hooks' module with a "shim".
      replace({
        include: getFilePathsInLib([
          // `import`s.
          './src/sequelize-typescript.ts',
        ]),
        values: {
          'node:async_hooks': getShimRequireReplacement('async_hooks'),
        },
        delimiters: ['require\\("', '"\\)'],
        // Doesn't skip replacing the left part of an assignment to such variable.
        // https://www.npmjs.com/package/@rollup/plugin-replace#user-content-preventassignment
        preventAssignment: false,
      }),

      // Replace 'fast-glob' module with a "shim".
      replace({
        include: getFilePathsInLib([
          // `import`s.
          './src/import-models.ts',
        ]),
        values: {
          'fast-glob': getShimRequireReplacement('fast-glob'),
        },
        delimiters: ['require\\("', '"\\)'],
        // Doesn't skip replacing the left part of an assignment to such variable.
        // https://www.npmjs.com/package/@rollup/plugin-replace#user-content-preventassignment
        preventAssignment: false,
      }),

      // Replace `Buffer` and `process` global variables with web browser "polyfills".
      inject({
        exclude: [
          './package.json',
        ],
        sourceMap: true,
        modules: {
          process: 'process',
          Buffer: ['buffer', 'Buffer'],
        },
      }),

      // Allows `require()`-ing "*.json" files.
      json(),

      // Adds support for `require()`ing CommonJS modules/packages.
      // By default, Rollup only understands ES6 ones.
      commonjs(),

      // Resolves `require()`s of packages from `node_modules`.
      nodeResolve({
        browser: true,
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

function getFilePathsInLib(filePaths) {
  return filePaths.map(filePath => {
    return filePath.replace('./src', './lib').replace(/\.ts$/, '.js');
  });
}

function getShimRequireReplacement(shimName) {
  const importPath = `./shims/${shimName}/index.js`;

  return `require(${JSON.stringify(resolve(__dirname, importPath))})`;
}
