const BASE10_NUMBER_SCIENTIFIC_REGEX = /^[-+]?[0-9]*(\.[0-9]+)?([eE][-+]?[0-9]+)?$/;

/**
 * Parses a string as a number in base 10.
 * Unlike {@link Number}, this method doesn't return 0 for ''
 * Unlike {@link parseInt}, this method returns NaN if it encounters any character that is not part of the number.
 *
 * @param value The string to parse as a floating point number
 * @returns NaN if the input is not a base 10 number, or Infinity
 */
export function parseNumber(value: string | bigint): number {
  if (typeof value === 'bigint') {
    if (value > Number.MAX_SAFE_INTEGER || value < Number.MIN_SAFE_INTEGER) {
      throw new TypeError(`Cannot cast BigInt ${value} to Number, because the value would be outside of the Safe Integer range.`);
    }

    return Number(value);
  }

  if (!BASE10_NUMBER_SCIENTIFIC_REGEX.test(value) && value !== 'Infinity' && value !== '-Infinity') {
    return Number.NaN;
  }

  if (value === '') {
    return Number.NaN;
  }

  return Number(value);
}

const BASE10_INTEGER_REGEX = /^[-+]?[0-9]+$/;

export function parseBigInt(value: number | string): bigint {
  if (typeof value === 'number') {
    if (Number.isInteger(value) && !Number.isSafeInteger(value)) {
      throw new TypeError(`Cannot cast Number ${value} to BigInt, because the value is already outside of the Safe Integer range. You need to use a String or BigInt instead of a Number for this value.`);
    }
  } else if (!BASE10_INTEGER_REGEX.test(value)) {
    throw new SyntaxError(`Cannot parse String ${value} as a BigInt.`);
  }

  return BigInt(value);
}
