import { isString } from '@sequelize/utils';
import type { TableOrModel } from '../abstract-dialect/query-generator.types.js';
import type { TableNameWithSchema } from '../abstract-dialect/query-interface.js';
import type { Model, ModelStatic } from '../model';
import { ModelDefinition } from '../model-definition.js';

/**
 * Returns true if the value is a model subclass.
 *
 * @param val The value whose type will be checked
 */
export function isModelStatic<M extends Model>(val: any): val is ModelStatic<M> {
  // TODO: temporary workaround due to cyclic import. Should not be necessary once Model is fully migrated to TypeScript.
  const { Model: TmpModel } = require('../model');

  return typeof val === 'function' && val.prototype instanceof TmpModel;
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
