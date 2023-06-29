// Rollup ended up not working:
//
// * For some reason, it didn't replace `require()` calls in `dialects/abstract/data-types.js` file.
//   Issue: https://github.com/rollup/rollup/issues/5048
//
// * For some reason, it doesn't replace `module.exports = ` expressions (e.g. in `data-types.js`) which results in a `ReferenceError: module is not defined` error in a web browser.
//   Issue: https://github.com/rollup/rollup/issues/5048
//
// Rollup was eventually replaced with ESBuild.

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import commonjs from '@rollup/plugin-commonjs';
import inject from '@rollup/plugin-inject';
import json from '@rollup/plugin-json';
import nodeResolve from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';
import terser from '@rollup/plugin-terser';
import aliases from './aliases.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function getConfig({ minify }) {
  return {
    // Builds a "bundle" from the output of `npm run build` command.
    input: './build-browser/index.js',

    plugins: [
      ...aliases.map(alias),

      // Replace `Buffer` and `process` global variables with web browser "polyfills".
      inject({
        exclude: [
          './package.json',
        ],
        sourceMap: true,
        modules: {
          // process: 'process',
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
  getConfig({ minify: true }),
];

function getFilePathsInLib(filePaths) {
  return filePaths.map(filePath => {
    return filePath.replace('./src', './lib').replace(/\.ts$/, '.js');
  });
}

function getShimPath(shimName) {
  const importPath = `./shims/${shimName}/index.js`;

  return resolve(__dirname, importPath);
}

function alias({ include, exclude, packages }) {
  return replace({
    include: include && getFilePathsInLib(include),
    exclude: exclude && getFilePathsInLib(exclude),
    values: Object.fromEntries(
      Object.keys(packages).map(packageName => [
        packageName, // key
        `require(${JSON.stringify(getShimPath(packages[packageName]))})`, // value
      ]),
    ),
    delimiters: ['require\\("', '"\\)'],
    // Doesn't skip replacing the left part of an assignment to such variable.
    // https://www.npmjs.com/package/@rollup/plugin-replace#user-content-preventassignment
    preventAssignment: false,
  });
}
