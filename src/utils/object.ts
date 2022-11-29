import isUndefined from 'lodash/isUndefined.js';
import omitBy from 'lodash/omitBy.js';

type NoUndefinedField<T> = { [P in keyof T]: Exclude<T[P], null | undefined> };

export function removeUndefined<T extends object | null | undefined>(val: T): NoUndefinedField<T> {
  return omitBy(val, isUndefined) as NoUndefinedField<T>;
}
