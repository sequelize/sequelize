/**
 * Parses a string as a safe integer in the specified radix.
 * This method supports the scientific notation (e.g. 5e1 produces 50).
 * The Scientific notation is only allowed in base 10.
 *
 * @param value The string to parse as a safe integer
 * @param radix The radix
 * @returns null if the input is not an integer or is not safely representable by the JS number type (use parseBigInt for that)
 */
export declare const parseSafeInteger: import("../_internal/build-parser.js").Parser<[value: string | bigint, radix?: number | undefined], number>;
