import isEmpty from 'lodash/isEmpty';
import isPlainObject from 'lodash/isPlainObject';
import type { DataType } from '..';
import { getOperators } from './format';
// eslint-disable-next-line import/order -- caused by temporarily mixing require with import
import { Where } from './sequelize-method';

const DataTypes = require('../data-types');

export function isPrimitive(val: any): val is string | number | boolean {
  const type = typeof val;

  return ['string', 'number', 'boolean'].includes(type);
}

export function isNodeError(val: any): val is NodeJS.ErrnoException {
  return val instanceof Error && 'code' in val;
}

export function isError(val: any): val is Error {
  return val instanceof Error;
}

export function isString(val: any): val is string {
  return typeof val === 'string';
}

/**
 * Returns whether `value` is using the nested syntax for attributes.
 *
 * @param value The attribute reference to check.
 *
 * @example
 * ```javascript
 * isColString('$id$'); // true
 * isColString('$project.name$'); // true
 * isColString('name'); // false
 * ```
 */
export function isColString(value: string): boolean {
  return (
    typeof value === 'string'
    && value.startsWith('$')
    && value.endsWith('$')
  );
}

export function canTreatArrayAsAnd(arr: unknown[]): arr is Array<object | Where> {
  return arr.some(arg => isPlainObject(arg) || arg instanceof Where);
}

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

/**
 * For use in per-dialect implementation of methods to warn the user when they use an option that TypeScript declares as valid,
 * but that the dialect they use does not support.
 *
 * @param methodName The name of the method that received the options
 * @param dialectName The name of the dialect to which the implementation belongs
 * @param allSupportableOptions All options that this method *can* support. The ones that are declared in TypeScript typings.
 * @param supportedOptions The subset of options that this dialect *actually does* support.
 * @param receivedOptions The user provided options that were passed to the method.
 */
export function rejectInvalidOptions(
  methodName: string,
  dialectName: string,
  allSupportableOptions: Set<string>,
  supportedOptions: Set<string>,
  receivedOptions: Record<string, unknown>,
): void {
  const receivedOptionNames = Object.keys(receivedOptions);
  const unsupportedOptions = receivedOptionNames.filter(optionName => {
    return allSupportableOptions.has(optionName) && !supportedOptions.has(optionName);
  });

  if (unsupportedOptions.length > 0) {
    throw buildInvalidOptionReceivedError(methodName, dialectName, unsupportedOptions);
  }
}

export function buildInvalidOptionReceivedError(methodName: string, dialectName: string, invalidOptions: string[]): Error {
  return new Error(`The following options are not supported by ${methodName} in ${dialectName}: ${invalidOptions.join(', ')}`);
}
