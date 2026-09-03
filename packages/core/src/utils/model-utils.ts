import { isString } from '@sequelize/utils';
import type { TableOrModel } from '../abstract-dialect/query-generator.types.js';
import type { TableNameWithSchema } from '../abstract-dialect/query-interface.js';
import type { Model, ModelStatic } from '../model';
import { ModelDefinition } from '../model-definition.js';

// Cache for the lazily-required Model class, see isModelStatic below.
let cachedModelClass: ModelStatic | undefined;

/**
 * Returns true if the value is a model subclass.
 *
 * @param val The value whose type will be checked
 */
export function isModelStatic<M extends Model>(val: any): val is ModelStatic<M> {
  // TODO: temporary workaround due to cyclic import. Should not be necessary once Model is fully migrated to TypeScript.
  // The result of this require() is cached after the first call: isModelStatic runs on a hot path (it is called
  // once per association while building queries), and re-running require() on every call adds non-trivial
  // module-resolution overhead under some loaders. The resolved Model class never changes once the module graph
  // is initialized, so caching it is safe.
  cachedModelClass ??= require('../model').Model as ModelStatic;

  return typeof val === 'function' && val.prototype instanceof cachedModelClass;
}

/**
 * Returns true if a & b are the same initial model, ignoring variants created by {@link Model.withSchema}, {@link Model.withScope}, and the like.
 *
 * The difference with doing `a === b` is that this method will also
 * return true if one of the models is scoped, or a variant with a different schema.
 *
 * @example
 * isSameInitialModel(a, a.withScope('myScope')) // true;
 *
 * @param a
 * @param b
 */
export function isSameInitialModel(a: ModelStatic<any>, b: ModelStatic<any>): boolean {
  return isModelStatic(a) && isModelStatic(b) && a.getInitialModel() === b.getInitialModel();
}

export function extractModelDefinition(tableOrModel: TableOrModel): ModelDefinition | null {
  if (tableOrModel instanceof ModelDefinition) {
    return tableOrModel;
  }

  if (isModelStatic(tableOrModel)) {
    return tableOrModel.modelDefinition;
  }

  return null;
}

export function extractTableIdentifier(tableOrModel: TableOrModel): TableNameWithSchema {
  if (isString(tableOrModel)) {
    return { tableName: tableOrModel };
  }

  return extractModelDefinition(tableOrModel)?.table ?? (tableOrModel as TableNameWithSchema);
}
