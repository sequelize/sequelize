import { isIterable } from '@sequelize/utils';
import pickBy from 'lodash/pickBy';
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
