import { getIsIntegerRegExp } from '../_internal/integer-regexp.js';

/**
 * Determines if the string follows the "integer" syntax.
 *
 * Does not determine whether the value could be represented using the Number or BigInt type.
 * Use {@link parseSafeInteger}, {@link parseBigInt} for that.
 *
 * @param value
 * @param radix
 */
export function isValidIntegerSyntax(value: string, radix: number = 10): boolean {
  const regex = getIsIntegerRegExp(radix);

  return regex.test(value);
}
