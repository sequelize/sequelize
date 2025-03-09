export type Comparator<T> = (a: T, b: T) => number;

/**
 * Used by comparator functions
 *
 * @example
 * [].sort(localizedStringComparator('en', SortDirection.DESC));
 */
export enum SortDirection {
  ASC = 1,
  DESC = -1,
}
