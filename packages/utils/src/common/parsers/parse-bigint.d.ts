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
export declare const parseBigInt: import("../_internal/build-parser.js").Parser<[value: string | number], bigint>;
