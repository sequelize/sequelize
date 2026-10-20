import { isAnyObject, isIterable } from '@sequelize/utils';
import type { AbstractDialect } from '../abstract-dialect/dialect.js';

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

export function isDevEnv(): boolean {
  return process.env.NODE_ENV !== 'production';
}

/**
 * For use in per-dialect implementation of methods to warn the user when they use an option that TypeScript declares as valid,
 * but that the dialect they use does not support.
 *
 * Only the options listed in {@link allSupportableOptions} are checked, any other property of {@link receivedOptions} is ignored.
 *
 * @param methodName The name of the method that received the options
 * @param dialect The dialect to which the implementation belongs
 * @param allSupportableOptions All options that this method *can* support. The ones that are declared in TypeScript typings.
 * @param supportedOptions The subset of options that this dialect *actually does* support.
 * @param receivedOptions The user provided options passed to the method. Can be undefined.
 */
export function rejectInvalidOptions<T extends string>(
  methodName: string,
  dialect: AbstractDialect,
  allSupportableOptions: Set<T>,
  supportedOptions: Iterable<T> | Partial<Record<T, boolean>>,
  receivedOptions: object | undefined,
): void {
  if (!isAnyObject(receivedOptions)) {
    return;
  }

  let parsedSupportedOptions: Set<string> | undefined;
  let unsupportedOptions: string[] | undefined;
  for (const optionName of allSupportableOptions) {
    const value = getEnumerablePropertyValue(receivedOptions, optionName);

    // This ignores any undefined or false values
    // It is therefore _essential_ that boolean options are false by default!
    if (value === undefined || value === false) {
      continue;
    }

    // Parsed lazily, as most calls do not receive any option
    parsedSupportedOptions ??= parseSupportedOptions(dialect, methodName, supportedOptions);
    if (parsedSupportedOptions.has(optionName)) {
      continue;
    }

    unsupportedOptions ??= [];
    unsupportedOptions.push(optionName);
  }

  if (unsupportedOptions) {
    // sorted so the error does not depend on the declaration order of allSupportableOptions
    throw buildInvalidOptionReceivedError(methodName, dialect.name, unsupportedOptions.sort());
  }
}

const { propertyIsEnumerable } = Object.prototype;

/**
 * Like `obj[propertyName]`, but returns undefined for non-enumerable properties without calling their getter.
 *
 * @param obj The object to read the property from
 * @param propertyName The name of the property
 */
function getEnumerablePropertyValue(obj: object, propertyName: string): unknown {
  if (propertyIsEnumerable.call(obj, propertyName)) {
    return (obj as Record<string, unknown>)[propertyName];
  }

  if (!(propertyName in obj)) {
    return undefined;
  }

  for (
    let current: object | null = obj;
    current != null;
    current = Object.getPrototypeOf(current)
  ) {
    const descriptor = Object.getOwnPropertyDescriptor(current, propertyName);
    if (descriptor) {
      if (!descriptor.enumerable) {
        return undefined;
      }

      // read via obj so getters get the right `this`
      return 'value' in descriptor
        ? descriptor.value
        : (obj as Record<string, unknown>)[propertyName];
    }
  }

  return undefined;
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
