import { buildNullBasedParser } from '../_internal/build-parser.js';
import { inspect } from '../inspect.js';
import { isBigInt } from '../predicates/is-big-int.js';
import { isNumber } from '../predicates/is-number.js';
import { isValidIntegerSyntax } from '../predicates/is-valid-integer-syntax.js';
import { parseFiniteNumber } from './parse-finite-number.js';

function parseSafeIntegerInternal(
  value: string | bigint | number,
  radix: number = 10,
): number | null {
  let result: number | null;
  if (isNumber(value)) {
    result = value;
  } else if (isBigInt(value) || radix === 10) {
    // delegating to parseNumber as it supports scientific notation & only base 10 is allowed
    result = parseFiniteNumber(value);
  } else {
    if (!isValidIntegerSyntax(value, radix)) {
      return null;
    }

    result = Number.parseInt(value, radix);
  }

  if (!Number.isSafeInteger(result)) {
    return null;
  }

  return result;
}

/**
 * Parses a string as a safe integer in the specified radix.
 * This method supports the scientific notation (e.g. 5e1 produces 50).
 * The Scientific notation is only allowed in base 10.
 *
 * @param value The string to parse as a safe integer
 * @returns null if the input is not an integer or is not safely representable by the JS number type (use parseBigInt for that)
 */
export const parseSafeInteger = buildNullBasedParser(
  parseSafeIntegerInternal,
  (value, radix = 10) => `Value ${inspect(value)} is not a valid base ${inspect(radix)} integer`,
);
