'use strict';

const hook = require('node-hook');
const esbuild = require('esbuild');
const sourceMapSupport = require('source-map-support');

const maps = {};

// This logic is sourced from https://github.com/babel/babel/blob/39ba1ff300a5c9448ccd40a50a017e7f24e5cd56/packages/babel-register/src/node.js#L15-L31
function installSourceMapSupport() {
  sourceMapSupport.install({
    handleUncaughtExceptions: false,
    environment: 'node',
    retrieveSourceMap(source) {
      const map = maps && maps[source];
      if (map) {
        return {
          url: null,
          map,
        };
      }

      return null;
    },
  });
}

function compileFor(loader) {
  return (source, sourcefile) => {
    const { code, map } = esbuild.transformSync(source, {
      sourcemap: true,
      target: 'node18',
      format: 'cjs',
      sourcefile,
      loader,
      tsconfigRaw: {
        compilerOptions: {
          target: 'node18',
          useDefineForClassFields: true,
          experimentalDecorators: true,
        },
      },
    });

    if (Object.keys(maps).length === 0) {
      installSourceMapSupport();
    }

    maps[sourcefile] = map;

    return code;
  };
}

hook.hook('.ts', compileFor('ts'));
