'use strict';
const path = require('path');
const hook = require('node-hook');
const esbuild = require('esbuild');
const moduleAlias = require('module-alias');
const sourceMapSupport = require('source-map-support');

const nodeMajorVersion = Number(process.version.match(/(?<=^v)\d+/));

// for node >= 12, we use the package.json "export" property to
//  map imports to dist (except package.json)
//  so "sequelize/lib/errors" is actually mapped to "sequelize/dist/errors/index.js"
//  (see package.json).
if (nodeMajorVersion < 12) {
  const jsonFile = path.join(__dirname, '..', 'package.json');
  moduleAlias.addAlias('sequelize/package.json', jsonFile);

  const distDir = path.join(__dirname, '..');
  // make imports from `sequelize/` go to `../dist/`
  moduleAlias.addAlias('sequelize', distDir);
}

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
          map
        };
      }

      return null;
    }
  });
}

function compileFor(loader) {
  return (source, sourcefile) => {
    const { code, map } = esbuild.transformSync(source, {
      sourcemap: true,
      target: 'node10',
      format: 'cjs',
      sourcefile,
      loader
    });

    if (Object.keys(maps).length === 0) {
      installSourceMapSupport();
    }

    maps[sourcefile] = map;

    return code;
  };
}

hook.hook('.ts', compileFor('ts'));
