import { noSqlJson } from '../utils/deprecations.js';
import { attribute } from './attribute.js';
import { where } from './where.js';

/**
 * Creates an object representing nested where conditions for postgres/sqlite/mysql json data-type.
 *
 * @param conditionsOrPath A hash containing strings/numbers or other nested hash, a string using dot notation or a string using postgres/sqlite/mysql json syntax.
 * @param value An optional value to compare against. Produces a string of the form "<json path> = '<value>'".
 *
 * @deprecated use {@link where}, {@link attribute}, and/or {@link jsonPath} instead.
 */
export function json(
  conditionsOrPath: { [key: string]: any } | string,
  value?: string | number | boolean | null,
) {
  noSqlJson();

  if (typeof conditionsOrPath === 'string') {
    const attr = attribute(conditionsOrPath);

    // json('profile.id') is identical to attribute('profile.id')
    if (value === undefined) {
      return attr;
    }

    // json('profile.id', value) is identical to where(attribute('profile.id'), value)
    return where(attr, value);
  }

  if (value === undefined && typeof conditionsOrPath === 'string') {
    return attribute(conditionsOrPath);
  }

  // json({ key: value }) is identical to where({ key: value })

  return where(conditionsOrPath);
}
