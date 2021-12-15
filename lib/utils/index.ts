import { getComplexKeys } from './format';

export * from './array';
export * from './check';
export * from './class-to-invokable';
export * from './dialect';
export * from './format';
export * from './join-sql-fragments';
export * from './object';
export * from './sequelize-method';
export * from './string';

/**
 * getComplexSize
 *
 * @param  {object|Array} obj
 * @returns {number}      Length of object properties including operators if obj is array returns its length
 * @private
 */
export function getComplexSize(obj: object | Array<any>): number {
  return Array.isArray(obj) ? obj.length : getComplexKeys(obj).length;
}
