#!/usr/bin/env node

/* eslint-disable unicorn/prefer-top-level-await */

import { build } from 'esbuild';
import glob from 'fast-glob';
import childProcess from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

// if this script is moved, this will need to be adjusted

const exec = promisify(childProcess.exec);

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const packages = await fs.readdir(`${rootDir}/packages`);

const packageName = process.argv[2];
if (!packageName || !packages.includes(packageName)) {
  console.error(
    `Please specify the name of the package to build: node build-packages.mjs <package-name> (one of ${packages.join(', ')})`,
  );
  process.exit(1);
}

console.info(`Compiling package ${packageName}`);

const packageDir = `${rootDir}/packages/${packageName}`;
const sourceDir = path.join(packageDir, 'src');
const libDir = path.join(packageDir, 'lib');

const [sourceFiles] = await Promise.all([
  // Find all .js and .ts files from /src.
  glob(`${glob.convertPathToPattern(sourceDir)}/**/*.{mjs,cjs,js,mts,cts,ts}`, {
    onlyFiles: true,
    absolute: false,
  }),
  // Delete /lib for a full rebuild.
  rmDir(libDir),
]);

const filesToCompile = [];
const filesToCopyToLib = [];

for (const file of sourceFiles) {
  // mjs files cannot be built as they would be compiled to commonjs
  if (file.endsWith('.mjs') || file.endsWith('.d.ts')) {
    filesToCopyToLib.push(file);
  } else {
    filesToCompile.push(file);
  }
}

await Promise.all([
  copyFiles(filesToCopyToLib, sourceDir, libDir),
  build({
    // Adds source mapping
    sourcemap: true,
    // The compiled code should be usable in node v18
    target: 'node18',
    // The source code's format is commonjs.
    format: 'cjs',

    outdir: libDir,
    entryPoints: filesToCompile.map(file => path.resolve(file)),
  }),

  exec('tsc --emitDeclarationOnly', {
    env: {
      // binaries installed from modules have symlinks in
      // <pkg root>/node_modules/.bin.
      PATH: `${process.env.PATH || ''}:${path.join(rootDir, 'node_modules/.bin')}`,
    },
    cwd: packageDir,
  }),
]);

const indexFiles = await glob(`${glob.convertPathToPattern(libDir)}/**/index.d.ts`, {
  onlyFiles: true,
  absolute: false,
});

// copy .d.ts files to .d.mts to provide typings for the ESM entrypoint
await Promise.all(
  indexFiles.map(async indexFile => {
    await fs.copyFile(indexFile, indexFile.replace(/.d.ts$/, '.d.mts'));
  }),
);

async function rmDir(dirName) {
  try {
    await fs.stat(dirName);
    await fs.rm(dirName, { recursive: true });
  } catch {
    /* no-op */
  }
}

async function copyFiles(files, fromFolder, toFolder) {
  await Promise.all(
    files.map(async file => {
      const to = path.join(toFolder, path.relative(fromFolder, file));
      const dir = path.dirname(to);
      await fs.mkdir(dir, { recursive: true });
      await fs.copyFile(file, to);
    }),
  );
}
