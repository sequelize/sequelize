import pickBy from 'lodash/pickBy';
import { BaseError } from '../errors/index.js';
import { Where } from '../expression-builders/where.js';

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
    // @ts-expect-error -- 'code' doesn't exist on Error, but it's dynamically added by Node
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

export function isBigInt(val: unknown): val is bigint {
  return typeof val === 'bigint';
}

export function isNumber(val: unknown): val is number {
  return typeof val === 'number';
}

/**
 * Works like lodash's isPlainObject, but has better typings
 *
 * @param value The value to check
 */
export function isPlainObject(value: unknown): value is object {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);

  return prototype === null || prototype === Object.prototype;
}

/**
 * This function is the same as {@link isPlainObject}, but types the result as a Record / Dictionary.
 * This function won't be necessary starting with TypeScript 4.9, thanks to improvements to the TS object type,
 * but we have to keep it until we drop support for TS < 4.9.
 *
 * @param value
 */
export function isDictionary(value: unknown): value is Record<PropertyKey, unknown> {
  return isPlainObject(value);
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
  receivedOptions: object,
): void {
  const receivedOptionNames = Object.keys(pickBy(receivedOptions));
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
