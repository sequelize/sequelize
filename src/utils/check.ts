import isPlainObject from 'lodash/isPlainObject';
import { Where } from './sequelize-method';

export function isNullish(val: unknown): val is null | undefined {
  return val == null;
}

export function isNodeError(val: unknown): val is NodeJS.ErrnoException {
  return val instanceof Error && 'code' in val;
}

export function isError(val: unknown): val is Error {
  return val instanceof Error;
}

export function isString(val: unknown): val is string {
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

