import { isAnyObject } from './predicates/is-any-object.js';
import { isBigInt } from './predicates/is-big-int.js';
import { isFunction } from './predicates/is-function.js';
import { isString } from './predicates/is-string.js';

/**
 * Stringify a value, for use in debug messages.
 * This is a bare-bones implementation of node:util's inspect method, designed to run in any environment.
 *
 * @param value The value to stringify
 * @returns A string representation of the value
 */
export function inspect(value: unknown): string {
  if (isString(value)) {
    return JSON.stringify(value);
  }

  if (isBigInt(value)) {
    return `${String(value)}n`;
  }

  if (isFunction(value)) {
    return `[function ${value.name || '(anonymous)'}]`;
  }

  if (isAnyObject(value)) {
    return Object.prototype.toString.call(value);
  }

  return String(value);
}
