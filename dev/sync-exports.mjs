#!/usr/bin/env node

import { EMPTY_OBJECT, arrayFromAsync, parallelForEach, pojo } from '@sequelize/utils';
import { listDirectories, listFilesRecursive, readFileIfExists } from '@sequelize/utils/node';
import isEqual from 'lodash/isEqual.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';

/**
 * does not modify the contents of the file but exits with code 1 if outdated, 0 if not
 */
const checkOutdated = process.argv.includes('--check-outdated');

/**
 * The package contains multiple individual exports that each need their own index file
 */
const multipleEntryPoints = process.argv.includes('--multi-entry-points');

const requestedSrcDir = process.argv[2];
if (!requestedSrcDir) {
  console.error('Please provide the path to the src folder to synchronize');
}

const srcDir = path.normalize(path.join(process.cwd(), requestedSrcDir));

console.info(
  `${checkOutdated ? 'Testing synchronization of' : 'Synchronizing'} exports of folder ${srcDir}`,
);

const folders = multipleEntryPoints
  ? (await listDirectories(srcDir)).map(folder => path.join(srcDir, folder))
  : [srcDir];

const outdatedPaths = [];

await parallelForEach(folders, async folder => {
  const files = await arrayFromAsync(listFilesRecursive(folder));

  const commonExports = [];

  /**
   * Absolute path of the source file of each export (keys are the ".js" paths used by the index files)
   */
  const sourceFiles = pojo();

  /**
   * You can provide a browser-specific or node-specific implementation by adding ".browser" or ".node" to their filename
   */
  const browserExportOverrides = pojo();
  const nodeExportOverrides = pojo();

  files
    .map(file => {
      const pathname = path.relative(folder, file).replace(/\.ts$/, '.js');
      sourceFiles[pathname] = file;

      return pathname;
    })
    .filter(pathname => {
      return (
        !/(^|\\)index\./.test(pathname) &&
        !pathname.startsWith('.DS_Store') &&
        !pathname.endsWith('.spec.js') &&
        !pathname.endsWith('.test.js') &&
        !/(^|[/\\])_/.test(pathname) &&
        !pathname.includes('.internal') &&
        !pathname.endsWith('.d.js')
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

  /**
   * Modules that only export types are re-exported using "export type *".
   * This is what the "@typescript-eslint/consistent-type-exports" rule requires.
   */
  const typeOnlyExports = new Set();
  await parallelForEach(Object.entries(sourceFiles), async ([pathname, file]) => {
    if (await isTypeOnlyModule(file)) {
      typeOnlyExports.add(pathname);
    }
  });

  const baseExports = getExportsWithOverrides(commonExports, EMPTY_OBJECT);
  const browserExports = getExportsWithOverrides(commonExports, browserExportOverrides);
  const nodeExports = getExportsWithOverrides(commonExports, nodeExportOverrides);

  const promises = [];
  promises.push(outputExports(baseExports, typeOnlyExports, path.join(folder, 'index.ts')));
  if (!isEqual(browserExports, baseExports)) {
    promises.push(
      outputExports(browserExports, typeOnlyExports, path.join(folder, 'index.browser.ts')),
    );
  }

  if (!isEqual(nodeExports, baseExports)) {
    promises.push(outputExports(nodeExports, typeOnlyExports, path.join(folder, 'index.node.ts')));
  }

  await Promise.all(promises);
});

async function outputExports(exports, typeOnlyExports, indexPath) {
  const imports = exports
    // sorted by the path, whether the export is a type-only one or not
    .map(pathname => {
      return { key: `./${pathname}';\n`, pathname };
    })
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
    .map(({ pathname }) => {
      const exportKeyword = typeOnlyExports.has(pathname) ? 'export type *' : 'export *';

      return `${exportKeyword} from './${pathname}';\n`;
    })
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

/**
 * Checks whether a TypeScript module only exports types (interfaces, type aliases and type-only exports).
 *
 * This errs on the side of caution: "export type *" does not re-export runtime values, so any export
 * that could exist at runtime (variables, functions, classes, enums, namespaces, default exports, value re-exports)
 * makes the module a regular one, as do JavaScript files.
 *
 * @param {string} filePath
 * @returns {Promise<boolean>}
 */
async function isTypeOnlyModule(filePath) {
  if (!filePath.endsWith('.ts')) {
    return false;
  }

  const contents = await fs.readFile(filePath, 'utf-8');
  const sourceFile = ts.createSourceFile(
    filePath,
    contents,
    ts.ScriptTarget.Latest,
    false,
    ts.ScriptKind.TS,
  );

  let exportsSomething = false;

  for (const statement of sourceFile.statements) {
    if (ts.isExportDeclaration(statement)) {
      const isTypeOnlyExport =
        statement.isTypeOnly ||
        (statement.exportClause != null &&
          ts.isNamedExports(statement.exportClause) &&
          statement.exportClause.elements.every(element => element.isTypeOnly));

      if (!isTypeOnlyExport) {
        return false;
      }

      exportsSomething = true;
      continue;
    }

    if (ts.isExportAssignment(statement)) {
      return false;
    }

    const modifiers = ts.canHaveModifiers(statement) ? ts.getModifiers(statement) : undefined;
    const isExported = modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword);
    if (!isExported) {
      continue;
    }

    if (ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) {
      exportsSomething = true;
      continue;
    }

    return false;
  }

  return exportsSomething;
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
