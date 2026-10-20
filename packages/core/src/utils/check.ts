import { isIterable } from '@sequelize/utils';
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
 * Options whose value is undefined or false are considered as not received.
 *
 * @param methodName The name of the method that received the options
 * @param dialect The dialect to which the implementation belongs
 * @param allSupportableOptions All options that this method *can* support. The ones that are declared in TypeScript typings.
 * @param supportedOptions The subset of options that this dialect *actually does* support.
 * @param receivedOptions The user provided options passed to the method. Can be undefined if the user did not provide any.
 */
export function rejectInvalidOptions<T extends string>(
  methodName: string,
  dialect: AbstractDialect,
  allSupportableOptions: Set<T>,
  supportedOptions: Iterable<T> | Partial<Record<T, boolean>>,
  receivedOptions: object | undefined,
): void {
  if (receivedOptions == null) {
    return;
  }

  const parsedSupportedOptions = parseSupportedOptions(dialect, methodName, supportedOptions);

  let unsupportedOptions: string[] | undefined;
  for (const optionName of allSupportableOptions) {
    if (parsedSupportedOptions.has(optionName)) {
      continue;
    }

    const value = (receivedOptions as Record<string, unknown>)[optionName];

    // This ignores any undefined or false values
    // It is therefore _essential_ that boolean options are false by default!
    if (
      value === undefined ||
      value === false ||
      !isEnumerableProperty(receivedOptions, optionName)
    ) {
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

/**
 * Returns whether the property is enumerable, either as an own property or one inherited from the prototype chain.
 * Non-enumerable properties (such as getters declared on a class) are not considered to be options.
 *
 * @param obj The object to check
 * @param propertyName The name of the property
 */
function isEnumerableProperty(obj: object, propertyName: string): boolean {
  for (
    let current: object | null = obj;
    current != null;
    current = Object.getPrototypeOf(current)
  ) {
    const descriptor = Object.getOwnPropertyDescriptor(current, propertyName);
    if (descriptor) {
      return descriptor.enumerable ?? false;
    }
  }

  return false;
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
