import isEmpty from 'lodash/isEmpty.js';
import { getOperators } from './where.js';
import * as DataTypes from '../data-types';
import type { DataType } from '../dialects/abstract/data-types.js';

/**
 * Determine if the default value provided exists and can be described
 * in a db schema using the DEFAULT directive.
 *
 * @param value Any default value.
 * @private
 */
export function defaultValueSchemable(value: DataType): boolean {
  if (value === undefined) {
    return false;
  }

  // TODO this will be schemable when all supported db
  //  have been normalized for this case
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
 * @param obj
 */
export function isWhereEmpty(obj: object): boolean {
  return Boolean(obj) && isEmpty(obj) && getOperators(obj).length === 0;
}
