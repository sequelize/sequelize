import { Where } from './sequelize-method';

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
    throw new Error('A non-error value was thrown', { cause: val });
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

