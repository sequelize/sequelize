import type { Parser } from '../_internal/build-parser.js';
import { buildNullBasedParser } from '../_internal/build-parser.js';
import { inspect } from '../inspect.js';
import { isBigInt } from '../predicates/is-big-int.js';
import { isValidNumberSyntax } from '../predicates/is-valid-number-syntax.js';

function parseFiniteNumberInternal(value: string | bigint): number | null {
  if (isBigInt(value)) {
    if (value > Number.MAX_SAFE_INTEGER || value < Number.MIN_SAFE_INTEGER) {
      return null;
    }

    return Number(value);
  }

  /**
   * radix has not been implemented because there is no built-in method we can rely on,
   * if it turns out we need it, feel free to implement one.
   */

  if (!isValidNumberSyntax(value)) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed;
}

/**
 * Parses a string as a number in base 10.
 *
 * Unlike {@link parseSafeInteger}, this function does not support specifying the radix, it is always base 10.
 * This parser can produce numbers that are not safely representable with the JS number type
 * This method will never produce infinite numbers.
 *
 * This method supports the scientific notation (e.g., 5e1 produces 50)
 *
 * If you are parsing integers, prefer {@link parseSafeInteger} or {@link parseBigInt} instead.
 *
 * @param value The string to parse as a floating point number
 * @returns null if the input is not a base 10 number
 */
export const parseFiniteNumber: Parser<[value: string | bigint], number> = buildNullBasedParser(
  parseFiniteNumberInternal,
  value => `Cannot convert ${inspect(value)} to a finite number.`,
);
