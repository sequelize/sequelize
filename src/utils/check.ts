import { BaseError } from '../errors/index.js';
import { Where } from './sequelize-method';

export function isPrimitive(val: any): val is string | number | boolean {
  const type = typeof val;

  return ['string', 'number', 'boolean'].includes(type);
}

export function isNullish(val: unknown): val is null | undefined {
  return val == null;
}

export function isNodeError(val: unknown): val is NodeJS.ErrnoException {
  return val instanceof Error && 'code' in val;
}

/**
 * Some dialects emit an Error with a string code, that are not ErrnoException.
 * This serves as a more generic check for those cases.
 *
 * @param val The value to check
 */
export function isErrorWithStringCode(val: unknown): val is Error & { code: string } {
  return val instanceof Error
    // @ts-expect-error
    && typeof val.code === 'string';
}

export function assertIsErrorWithStringCode(val: unknown): asserts val is Error & { code: string } {
  if (!isErrorWithStringCode(val)) {
    throw new Error('Expected Error with string "code" property');
  }
}

export function isError(val: unknown): val is Error {
  return val instanceof Error;
}

export function assertCaughtError(val: unknown): asserts val is Error {
  if (!isError(val)) {
    throw new BaseError('A non-error value was thrown', { cause: val });
  }
}

export function isString(val: unknown): val is string {
  return typeof val === 'string';
}

/**
 * Works like lodash's isPlainObject, but has better typings
 *
 * @param value The value to check
 */
export function isPlainObject(value: unknown): value is Record<PropertyKey, any> {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);

  return prototype === null || prototype === Object.prototype;
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
