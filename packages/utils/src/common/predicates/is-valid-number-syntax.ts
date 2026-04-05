const BASE10_NUMBER_REGEX = /^-?[0-9]*(\.[0-9]+)?([eE][-+]?[0-9]+)?$/;

/**
 * Determines if the string follows the "number" syntax: Base 10 numbers that can have a decimal part
 * and be written using the scientific notation.
 *
 * Does not determine whether the value could be represented using the Number type. Use {@link parseFiniteNumber} for that.
 *
 * @param value
 */
export function isValidNumberSyntax(value: string): boolean {
  return value !== '' && value !== '-' && BASE10_NUMBER_REGEX.test(value);
}
