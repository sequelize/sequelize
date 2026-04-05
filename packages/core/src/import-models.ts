import { isPlainObject } from '@sequelize/utils';
import glob from 'fast-glob';
import uniq from 'lodash/uniq';
import { pathToFileURL } from 'node:url';
import type { ModelStatic } from './model.js';
import { isModelStatic } from './utils/model-utils.js';

type ModelMatch = (path: string, exportName: string, exportValue: ModelStatic) => boolean;

/**
 * Imports all model classes exported in the file matching the specified globs.
 * Useful when setting the "models" option in the Sequelize constructor.
 *
 * @param globPaths
 * @param modelMatch
 */
export async function importModels(
  globPaths: string | string[],
  modelMatch?: ModelMatch,
): Promise<ModelStatic[]> {
  if (Array.isArray(globPaths)) {
    const promises: Array<Promise<ModelStatic[]>> = [];

    for (const globPath of globPaths) {
      promises.push(importModels(globPath, modelMatch));
    }

    return uniq((await Promise.all(promises)).flat(1));
  }

  const promises: Array<Promise<ModelStatic[]>> = [];
  for (const path of await glob(globPaths)) {
    const url = pathToFileURL(path).href;
    promises.push(importModelNoGlob(url, modelMatch));
  }

  return uniq((await Promise.all(promises)).flat(1));
}

async function importModelNoGlob(url: string, modelMatch?: ModelMatch): Promise<ModelStatic[]> {
  let module = await import(url);
  // When importing a CJS file, sometimes only the default export is available,
  // as named exports depend on the file's exports being statically analyzable by node.
  // The default export contains the contents of the file's `module.exports`
  if (module.default && isPlainObject(module.default)) {
    module = { ...module.default, ...module };
  }

  return Object.keys(module)
    .filter(exportName => {
      if (!isModelStatic(module[exportName])) {
        return false;
      }

      if (modelMatch) {
        return modelMatch(url, exportName, module[exportName]);
      }

      return true;
    })
    .map(exportName => module[exportName]);
}
