const numericSymbols = [
  '0',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  'A',
  'B',
  'C',
  'D',
  'E',
  'F',
  'G',
  'H',
  'I',
  'J',
  'K',
  'L',
  'M',
  'N',
  'O',
  'P',
  'Q',
  'R',
  'S',
  'T',
  'U',
  'V',
  'W',
  'X',
  'Y',
  'Z',
];

export const MAX_RADIX_INCLUSIVE = 36;
export const MIN_RADIX_INCLUSIVE = 2;

const integerRegExps: Array<RegExp | undefined> = Array.from({ length: numericSymbols.length });

export function getIsIntegerRegExp(radix: number): RegExp {
  if (radix < MIN_RADIX_INCLUSIVE || radix > MAX_RADIX_INCLUSIVE) {
    throw new RangeError(
      `parseSafeInteger() radix argument must be between ${MIN_RADIX_INCLUSIVE} and ${MAX_RADIX_INCLUSIVE}`,
    );
  }

  const existingRegExp = integerRegExps[radix];
  if (existingRegExp) {
    return existingRegExp;
  }

  /**
   * Get all characters that are valid digits in this base (radix)
   *
   * Example: if radix = 16, characterSet will include [0, 1, ..., e, f]
   */
  const characterSet = numericSymbols.slice(0, radix);

  /**
   * Construct a regex that matches whether the input is a valid integer in this radix
   *
   * Example, if radix = 2, the regex will be:
   * /^-?[01]+$/i
   *
   * "i" for case insensitivity
   */
  const newRegExp = new RegExp(`^-?[${characterSet.join('')}]+$`, 'i');

  integerRegExps[radix] = newRegExp;

  return newRegExp;
}
