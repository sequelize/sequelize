import { buildNullBasedParser } from '../_internal/build-parser.js';
import { inspect } from '../inspect.js';
import { isNumber } from '../predicates/is-number.js';

/**
 * The base 10 regex is special because it accepts the scientific notation
 */
const BASE10_INTEGER_REGEX =
  /^(?<integerStr>-?[0-9]*)(\.(?<decimalStr>[0-9]+))?([eE](?<exponentStr>[-+]?[0-9]+))?$/;

function parseBigIntInternal(value: string | number): bigint | null {
  if (isNumber(value)) {
    if (!Number.isSafeInteger(value)) {
      return null;
    }

    return BigInt(value);
  }

  if (value === '') {
    return null;
  }

  if (!BASE10_INTEGER_REGEX.test(value)) {
    return null;
  }

  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

/**
 * Parses a string as a bigint in base 10.
 *
 * Unlike {@link parseSafeInteger}, this function does not support specifying the radix; it is always base 10.
 * This method supports the scientific notation (e.g. 5e1 produces 50n).
 * The Scientific notation is only allowed in base 10.
 *
 * @param value The string to parse as a safe integer
 * @returns The corresponding bigint value
 */
export const parseBigInt = buildNullBasedParser(
  parseBigIntInternal,
  value => `Cannot convert ${inspect(value)} to a BigInt.`,
);
