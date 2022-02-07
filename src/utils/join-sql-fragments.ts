import { SQLFragment, TruthySQLFragment } from '../generic/sql-fragment';

function doesNotWantLeadingSpace(str: string): boolean {
  return /^[;,)]/.test(str);
}
function doesNotWantTrailingSpace(str: string): boolean {
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

/**
 * Joins an array with a single space, auto trimming when needed.
 *
 * Certain elements do not get leading/trailing spaces.
 *
 * @param {SQLFragment[]} array The array to be joined. Falsy values are skipped. If an
 * element is another array, this function will be called recursively on that array.
 * Otherwise, if a non-string, non-falsy value is present, a TypeError will be thrown.
 *
 * @returns {string} The joined string.
 *
 * @private
 */
export function joinSQLFragments(array: SQLFragment[]): string {
  if (array.length === 0) return '';

  const truthyArray: TruthySQLFragment[] = array.filter(
    (x): x is string | SQLFragment[] => !!x
  );
  const flattenedArray: string[] = truthyArray.map(
    (fragment: TruthySQLFragment) => {
      if (Array.isArray(fragment)) {
        return joinSQLFragments(fragment);
      }

      return fragment;
    }
  );

  // Ensure strings
  for (const fragment of flattenedArray) {
    if (fragment && typeof fragment !== 'string') {
      throw new JoinSQLFragmentsError(
        flattenedArray,
        fragment,
        `Tried to construct a SQL string with a non-string, non-falsy fragment (${fragment}).`
      );
    }
  }

  // Trim fragments
  const trimmedArray = flattenedArray.map(x => x.trim());

  // Skip full-whitespace fragments (empty after the above trim)
  const nonEmptyStringArray = trimmedArray.filter(x => x !== '');

  return singleSpaceJoinHelper(nonEmptyStringArray);
}

export class JoinSQLFragmentsError extends TypeError {
  args: SQLFragment[];
  fragment: any; // iirc this error is only used when we get an invalid fragment.

  constructor(args: SQLFragment[], fragment: any, message: string) {
    super(message);
    
    this.args = args;
    this.fragment = fragment;
    this.name = 'JoinSQLFragmentsError';
  }
}
