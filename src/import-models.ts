import glob from 'fast-glob';
import uniq from 'lodash/uniq';
import type { ModelStatic } from './model.js';
import { isModelStatic } from './utils/model-utils.js';

type ModelMatch = (path: string, exportName: string, exportValue: ModelStatic) => boolean;

/**
 * Imports all model classes exported in the file matching the specified globs.
 * Useful when setting the {@link Option.models} option in the Sequelize constructor.
 *
 * @param globPaths
 * @param modelMatch
 */
export async function importModels(globPaths: string | string[], modelMatch?: ModelMatch): Promise<ModelStatic[]> {
  if (Array.isArray(globPaths)) {
    const promises: Array<Promise<ModelStatic[]>> = [];

    for (const globPath of globPaths) {
      promises.push(importModels(globPath, modelMatch));
    }

    return uniq((await Promise.all(promises)).flat(1));
  }

  const promises: Array<Promise<ModelStatic[]>> = [];
  for (const path of await glob(globPaths)) {
    promises.push(importModelNoGlob(path, modelMatch));
  }

  return uniq((await Promise.all(promises)).flat(1));
}

async function importModelNoGlob(path: string, modelMatch?: ModelMatch): Promise<ModelStatic[]> {
  const module = await import(path);

  return Object.keys(module)
    .filter(exportName => {
      if (!isModelStatic(module[exportName])) {
        return false;
      }

      if (modelMatch) {
        return modelMatch(path, exportName, module[exportName]);
      }

      return true;
    })
    .map(exportName => module[exportName]);
}
