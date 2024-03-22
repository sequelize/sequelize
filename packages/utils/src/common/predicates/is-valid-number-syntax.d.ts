/**
 * Determines if the string follows the "number" syntax: Base 10 numbers that can have a decimal part
 * and be written using the scientific notation.
 *
 * Does not determine whether the value could be represented using the Number type. Use {@link parseFiniteNumber} for that.
 *
 * @param value
 */
export declare function isValidNumberSyntax(value: string): boolean;
