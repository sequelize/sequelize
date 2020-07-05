function doesNotWantLeadingSpace(str: string) {
  return /^[;,)]/.test(str);
}
function doesNotWantTrailingSpace(str: string) {
  return /\($/.test(str);
}

/**
 * Joins an array of strings with a single space between them,
 * except for:
 *
 * - Strings starting with ';', ',' and ')', which do not get a leading space.
 * - Strings ending with '(', which do not get a trailing space.
 *
 * @param {string[]} parts
 * @returns {string}
 *
 * @private
 */
function singleSpaceJoinHelper(parts: string[]): string {
  return parts.reduce(
    ({ skipNextLeadingSpace, result }, part) => {
      if (skipNextLeadingSpace || doesNotWantLeadingSpace(part)) {
        result += part.trim();
      } else {
        result += ` ${part.trim()}`;
      }
      return {
        skipNextLeadingSpace: doesNotWantTrailingSpace(part),
        result
      };
    },
    {
      skipNextLeadingSpace: true,
      result: ''
    }
  ).result;
}

type SQLFragment = string | unknown | SQLFragment[];

/**
 * Joins an array with a single space, auto trimming when needed.
 *
 * Certain elements do not get leading/trailing spaces.
 *
 * @param {unknown[]} array The array to be joined. Falsy values are skipped. If an
 * element is another array, this function will be called recursively on that array.
 * Otherwise, if a non-string, non-falsy value is present, a TypeError will be thrown.
 *
 * @returns {string} The joined string.
 *
 * @private
 */
export function joinSQLFragments(array: SQLFragment[]): string {
  if (array.length === 0) return '';

  // Skip falsy fragments
  array = array.filter(x => x);

  // Resolve recursive calls
  array = array.map(fragment => {
    if (Array.isArray(fragment)) {
      return joinSQLFragments(fragment);
    }
    return fragment;
  });

  // Ensure strings
  for (const fragment of array) {
    if (fragment && typeof fragment !== 'string') {
      throw new Error(
        `Tried to construct a SQL string with a non-string, non-falsy fragment (${fragment}) with args (${array}).`
      );
    }
  }

  let strings = array.filter(item => typeof item === 'string').map(item => item + '');

  // Trim fragments
  strings = strings.map(item => item.trim());

  // Skip full-whitespace fragments (empty after the above trim)
  strings = strings.filter(item => item !== '');

  return singleSpaceJoinHelper(strings);
}
