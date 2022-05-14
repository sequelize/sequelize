/**
 * @file Contains shared items essential for dialect-specific code.
 * @public
 */
import type { Dialect } from './sequelize.js';

export type DialectTypeMeta =
  | string[]
  | number[]
  | [null]
  | false;

/**
 * A symbol which is used in data-types as the key of a function which registers dialect-specific
 * variations of a type.
 */
const kDialectMap = Symbol('sequelize.DialectMap');

/**
 * Helper used to add a dialect to `types` of a DataType.  It ensures that it doesn't modify the types of its parent.
 *
 * @param dataType
 * @param dialectName The dialect the types apply to
 * @param types The dialect-specific types.
 */
export function setDataTypeDialectMeta(dataType: Function, dialectName: Dialect, types: DialectTypeMeta) {
  if (!Object.prototype.hasOwnProperty.call(dataType, kDialectMap)) {
    Object.defineProperty(dataType, kDialectMap, {
      value: new Map(),
      writable: false,
      enumerable: false,
      configurable: false,
    });
  }

  // @ts-expect-error -- the property is not declared as we're adding it dynamically, and it's only used here.
  const map = dataType[kDialectMap] as Map<string, DialectTypeMeta>;
  map.set(dialectName, types);
}

export function getDataTypeDialectMeta(dataType: Function, dialectName: Dialect): DialectTypeMeta | undefined {
  // @ts-expect-error -- the property is not declared as we're adding it dynamically, and it's only used here.
  return dataType[kDialectMap]?.get(dialectName);
}
