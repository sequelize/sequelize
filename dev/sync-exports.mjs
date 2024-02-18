#!/usr/bin/env node

import { arrayFromAsync, parallelForEach, pojo } from '@sequelize/utils';
import { listDirectories, listFilesRecursive, readFileIfExists } from '@sequelize/utils/node.js';
import isEqual from 'lodash/isEqual.js';
import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * does not modify the contents of the file but exits with code 1 if outdated, 0 if not
 */
const checkOutdated = process.argv.includes('--check-outdated');

const requestedSrcDir = process.argv[2];
if (!requestedSrcDir) {
  console.error('Please provide the path to the src folder to synchronize');
}

const srcDir = path.normalize(path.join(process.cwd(), requestedSrcDir));

console.info(
  `${checkOutdated ? 'Testing synchronization of' : 'Synchronizing'} exports of folder ${srcDir}`,
);

const folders = await listDirectories(srcDir);

const outdatedPaths = [];

await parallelForEach(folders, async folder => {
  const folderAbsolutePath = path.join(srcDir, folder);

  const files = await arrayFromAsync(listFilesRecursive(folderAbsolutePath));

  const commonExports = [];

  /**
   * You can provide a browser-specific or node-specific implementation by adding ".browser" or ".node" to their filename
   */
  const browserExportOverrides = pojo();
  const nodeExportOverrides = pojo();

  files
    .map(file => {
      return path.relative(folderAbsolutePath, file).replace(/\.ts$/, '.js');
    })
    .filter(pathname => {
      return (
        !/(^|\\)index\./.test(pathname) &&
        !pathname.startsWith('.DS_Store') &&
        !pathname.endsWith('.spec.ts') &&
        !pathname.includes('__tests__/') &&
        !pathname.includes('_internal/')
      );
    })
    // eslint-disable-next-line unicorn/no-array-for-each -- clearer like this, perf doesn't matter
    .forEach(pathname => {
      if (pathname.includes('.node.')) {
        nodeExportOverrides[pathname.replace('.node.', '.')] = pathname;
      } else if (pathname.includes('.browser.')) {
        browserExportOverrides[pathname.replace('.browser.', '.')] = pathname;
      } else {
        commonExports.push(pathname);
      }
    });

  const browserExports = getExportsWithOverrides(commonExports, browserExportOverrides);
  const nodeExports = getExportsWithOverrides(commonExports, nodeExportOverrides);

  if (isEqual(browserExports, nodeExports)) {
    await outputExports(browserExports, path.join(folderAbsolutePath, 'index.ts'));
  } else {
    await Promise.all([
      outputExports(browserExports, path.join(folderAbsolutePath, 'index.browser.ts')),
      outputExports(nodeExports, path.join(folderAbsolutePath, 'index.node.ts')),
    ]);
  }
});

async function outputExports(exports, indexPath) {
  const imports = exports
    .map(pathname => {
      return `export * from './${pathname}';\n`;
    })
    .sort()
    .join('');

  const fileContents = `/** Generated File, do not modify directly. Run "yarn sync-exports" in the folder of the package instead */\n\n${imports}`;

  const file = await readFileIfExists(indexPath, 'utf-8');
  if (file === null || file !== fileContents) {
    outdatedPaths.push(indexPath);
  }

  if (!checkOutdated) {
    await fs.writeFile(indexPath, fileContents, 'utf-8');
  }
}

function getExportsWithOverrides(commonExports, platformExportOverrides) {
  const platformExportKeys = Object.keys(platformExportOverrides);
  if (platformExportKeys.length === 0) {
    return commonExports;
  }

  const platformExports = [];

  /** Add exports that were not replaced by another */
  for (const commonExport of commonExports) {
    if (platformExportOverrides[commonExport]) {
      continue;
    }

    platformExports.push(commonExport);
  }

  platformExports.push(...Object.values(platformExportOverrides));

  return platformExports;
}

if (outdatedPaths.length === 0) {
  console.info('All index files up-to-date');
} else {
  const fileListStr = outdatedPaths.map(pathname => `- ${pathname}\n`).join('');
  if (checkOutdated) {
    console.info(`Outdated files:\n${fileListStr}`);
    process.exit(1);
  } else {
    console.info(`Updated files:\n${fileListStr}`);
  }
}
