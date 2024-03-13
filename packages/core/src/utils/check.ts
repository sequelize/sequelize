import pickBy from 'lodash/pickBy';
import type { AbstractDialect } from '../dialects/abstract/index.js';
import { BaseError } from '../errors/index.js';

export function isNullish(val: unknown): val is null | undefined {
  return val == null;
}

export function isNodeError(val: unknown): val is NodeJS.ErrnoException {
  return val instanceof Error && 'code' in val;
}

export function isIterable(val: unknown): val is Iterable<unknown> {
  // @ts-expect-error -- TS does not allow accessing Symbol.iterator like this.
  return val != null && val[Symbol.iterator];
}

/**
 * Some dialects emit an Error with a string code, that are not ErrnoException.
 * This serves as a more generic check for those cases.
 *
 * @param val The value to check
 */
export function isErrorWithStringCode(val: unknown): val is Error & { code: string } {
  return (
    val instanceof Error &&
    // @ts-expect-error -- 'code' doesn't exist on Error, but it's dynamically added by Node
    typeof val.code === 'string'
  );
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

export function isDevEnv(): boolean {
  return process.env.NODE_ENV !== 'production';
}

/**
 * For use in per-dialect implementation of methods to warn the user when they use an option that TypeScript declares as valid,
 * but that the dialect they use does not support.
 *
 * @param methodName The name of the method that received the options
 * @param dialect The dialect to which the implementation belongs
 * @param allSupportableOptions All options that this method *can* support. The ones that are declared in TypeScript typings.
 * @param supportedOptions The subset of options that this dialect *actually does* support.
 * @param receivedOptions The user provided options passed to the method.
 */
export function rejectInvalidOptions<T extends string>(
  methodName: string,
  dialect: AbstractDialect,
  allSupportableOptions: Set<T>,
  supportedOptions: Iterable<T> | Partial<Record<T, boolean>>,
  receivedOptions: object,
): void {
  const receivedOptionNames = Object.keys(
    // This removes any undefined or false values from the object
    // It is therefore _essential_ that boolean options are false by default!
    pickBy(receivedOptions, value => value !== undefined && value !== false),
  );
  const parsedSupportedOptions = parseSupportedOptions(dialect, methodName, supportedOptions);

  const unsupportedOptions = receivedOptionNames.filter(optionName => {
    return allSupportableOptions.has(optionName as T) && !parsedSupportedOptions.has(optionName);
  });

  if (unsupportedOptions.length > 0) {
    throw buildInvalidOptionReceivedError(methodName, dialect.name, unsupportedOptions);
  }
}

const SUPPORTED_OPTIONS_CACHE = new WeakMap<AbstractDialect, Map<string, Set<string>>>();

function parseSupportedOptions(
  dialect: AbstractDialect,
  methodName: string,
  rawSupportedOptions: Iterable<string> | Partial<Record<string, boolean>>,
): Set<string> {
  let dialectCache = SUPPORTED_OPTIONS_CACHE.get(dialect);
  if (!dialectCache) {
    dialectCache = new Map();
    SUPPORTED_OPTIONS_CACHE.set(dialect, dialectCache);
  }

  let supportedOptions: Set<string> | undefined = dialectCache.get(methodName);
  if (!supportedOptions) {
    if (isIterable(rawSupportedOptions)) {
      supportedOptions = new Set(rawSupportedOptions);
    } else {
      supportedOptions = new Set();
      for (const optionName of Object.keys(rawSupportedOptions)) {
        if (rawSupportedOptions[optionName]) {
          supportedOptions.add(optionName);
        }
      }
    }

    dialectCache.set(methodName, supportedOptions);
  }

  return supportedOptions;
}

export function buildInvalidOptionReceivedError(
  methodName: string,
  dialectName: string,
  invalidOptions: string[],
): Error {
  return new Error(
    `The following options are not supported by ${methodName} in ${dialectName}: ${invalidOptions.join(', ')}`,
  );
}
