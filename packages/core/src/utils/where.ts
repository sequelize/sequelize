import { Op as operators } from '../operators.js';

/**
 * getComplexKeys
 *
 * @param obj
 * @returns All keys including operators
 * @private
 */
export function getComplexKeys(obj: object): Array<string | symbol> {
  return [...getOperators(obj), ...Object.keys(obj)];
}

/**
 * getComplexSize
 *
 * @param obj
 * @returns Length of object properties including operators if obj is array returns its length
 * @private
 */
export function getComplexSize(obj: object | any[]): number {
  return Array.isArray(obj) ? obj.length : getComplexKeys(obj).length;
}

const operatorsSet = new Set(Object.values(operators));

/**
 * getOperators
 *
 * @param obj
 * @returns All operators properties of obj
 * @private
 */
export function getOperators(obj: object): symbol[] {
  return Object.getOwnPropertySymbols(obj).filter(s => operatorsSet.has(s));
}
