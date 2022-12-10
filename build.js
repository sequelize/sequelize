'use strict';

const glob = require('fast-glob');
const { promisify } = require('node:util');
const { build } = require('esbuild');
const fs = require('node:fs');
const copyFiles = promisify(require('copyfiles'));
const path = require('node:path');
const exec = promisify(require('node:child_process').exec);

const stat = promisify(fs.stat);

// if this script is moved, this will need to be adjusted
const rootDir = __dirname;
const outdir = path.join(rootDir, 'lib');
const typesDir = path.join(rootDir, 'types');

async function rmDir(dirName) {
  try {
    await stat(dirName);
    const rm = promisify(fs.rm);
    await rm(dirName, { recursive: true });
  } catch {
    /* no-op */
  }
}

async function main() {
  console.info('Compiling sequelize...');
  const [sourceFiles] = await Promise.all([
    // Find all .js and .ts files from /src
    glob('./src/**/*.{mjs,cjs,js,mts,cts,ts}', { onlyFiles: true, absolute: false }),
    // Delete /lib for a full rebuild.
    rmDir(outdir),
    // Delete /types for a full rebuild.
    rmDir(typesDir),
  ]);

  const filesToCompile = [];
  const filesToCopyToLib = [];
  const declarationFiles = [];

  for (const file of sourceFiles) {
    // mjs files cannot be built as they would be compiled to commonjs
    if (file.endsWith('.mjs')) {
      filesToCopyToLib.push(file);
    } else if (file.endsWith('.d.ts')) {
      declarationFiles.push(file);
    } else {
      filesToCompile.push(file);
    }
  }

  // copy .d.ts files prior to generating them from the .ts files
  // so the .ts files in lib/ will take priority..
  await copyFiles(
    // The last path in the list is the output directory
    [...declarationFiles, typesDir],
    { up: 1 },
  );

  if (filesToCopyToLib.length > 0) {
    await copyFiles(
      // The last path in the list is the output directory
      filesToCopyToLib.concat(outdir),
      { up: 1 },
    );
  }

  await Promise.all([
    build({
      // Adds source mapping
      sourcemap: true,
      // The compiled code should be usable in node v14.17
      target: 'node14.17',
      // The source code's format is commonjs.
      format: 'cjs',

      outdir,
      entryPoints: filesToCompile
        .map(file => path.resolve(file)),
    }),

    exec('tsc', {
      env: {
        // binaries installed from modules have symlinks in
        // <pkg root>/node_modules/.bin.
        PATH: `${process.env.PATH || ''}:${path.join(
          rootDir,
          'node_modules/.bin',
        )}`,
      },
      cwd: rootDir,
    }),
  ]);
}

main().catch(console.error).finally(process.exit);

