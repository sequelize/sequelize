import json from '@rollup/plugin-json';
import commonjs from '@rollup/plugin-commonjs';
import nodeResolve from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';

export default [
  {
    input: './lib/index.js',
    plugins: [
      json(),
      commonjs(),
      nodeResolve({
        browser: true,
      }),
      replace({
        include: ['./packages/core/src/dialects/abstract/query.js'],
        values: {
          crypto: JSON.stringify('.../../../build/shims/crypto.js'),
        },
        delimiters: ['require(\'', '\')'],
        // Doesn't skip replacing the left part of an assignment to such variable.
        // https://www.npmjs.com/package/@rollup/plugin-replace#user-content-preventassignment
        preventAssignment: false,
      }),
    ],
    output: {
      format: 'umd',
      name: 'Sequelize',
      file: 'bundle/sequelize.min.js',
      sourcemap: true,
    },
  },
];
