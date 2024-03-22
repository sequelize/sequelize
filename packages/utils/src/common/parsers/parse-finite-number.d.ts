import type { Parser } from '../_internal/build-parser.js';
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
export declare const parseFiniteNumber: Parser<[value: string | bigint], number>;
