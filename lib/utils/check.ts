import _ from 'lodash';
import DataTypes from '../data-types';
import { getOperators } from './format';

export function isPrimitive(val: any) {
  const type = typeof val;
  return ['string', 'number', 'boolean'].includes(type);
}

export function isColString(value: string | string[]): boolean {
  return (
    typeof value === 'string' &&
    value[0] === '$' &&
    value[value.length - 1] === '$'
  );
}

export function canTreatArrayAsAnd(arr: any[]) {
  return arr.some(arg => _.isPlainObject(arg) || arg instanceof Where);
}

/**
 * Determine if the default value provided exists and can be described
 * in a db schema using the DEFAULT directive.
 *
 * @param  {*} value Any default value.
 * @returns {boolean} yes / no.
 * @private
 */
export function defaultValueSchemable(value: any): boolean {
  if (value === undefined) {
    return false;
  }

  // TODO this will be schemable when all supported db
  // have been normalized for this case
  if (value instanceof DataTypes.NOW) {
    return false;
  }

  if (value instanceof DataTypes.UUIDV1 || value instanceof DataTypes.UUIDV4) {
    return false;
  }

  return typeof value !== 'function';
}

/**
 * Returns true if a where clause is empty, even with Symbols
 *
 * @param  {object} obj
 * @returns {boolean}
 * @private
 */
export function isWhereEmpty(obj: object): boolean {
  return !!obj && _.isEmpty(obj) && getOperators(obj).length === 0;
}
