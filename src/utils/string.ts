import _inflection from 'inflection';

/* Inflection */
type Inflection = typeof _inflection;

let inflection: Inflection = _inflection;

export function useInflection(newInflection: Inflection) {
  inflection = newInflection;
}

/* String utils */

export function camelizeIf(str: string, condition: boolean): string {
  let result = str;

  if (condition) {
    result = camelize(str);
  }

  return result;
}

export function camelize(str: string): string {
  return str.trim().replace(/[-_\s]+(.)?/g, (match, c) => c.toUpperCase());
}

export function underscoredIf(str: string, condition: boolean): string {
  let result = str;

  if (condition) {
    result = underscore(str);
  }

  return result;
}

export function underscore(str: string): string {
  return inflection.underscore(str);
}

export function spliceStr(
  str: string,
  index: number,
  count: number,
  add: string,
): string {
  return str.slice(0, index) + add + str.slice(index + count);
}

export function singularize(str: string): string {
  return inflection.singularize(str);
}

export function pluralize(str: string): string {
  return inflection.pluralize(str);
}

type NameIndexIndex = {
  fields: Array<{ name: string, attribute: string }>,
  name: string,
};
type NameIndexTableName = string | { tableName: string };

/**
 *
 * @param index
 * @param index.fields
 * @param index.name
 * @param tableName
 *
 * @private
 */
export function nameIndex(
  index: NameIndexIndex,
  tableName: NameIndexTableName,
) {
  if (typeof tableName !== 'string' && tableName.tableName) {
    tableName = tableName.tableName;
  }

  if (!Object.prototype.hasOwnProperty.call(index, 'name')) {
    const fields = index.fields.map(field => (typeof field === 'string' ? field : field.name || field.attribute));
    index.name = underscore(`${tableName}_${fields.join('_')}`);
  }

  return index;
}

/**
 * Stringify a value as JSON with some differences:
 * - bigints are stringified as a json string. (`safeStringifyJson({ val: 1n })` outputs `'{ "val": "1" }'`).
 *   This is because of a decision by TC39 to not support bigint in JSON.stringify https://github.com/tc39/proposal-bigint/issues/24
 *
 * @param stringifyTarget the value to stringify.
 * @returns the resulting json.
 */
export function safeStringifyJson(stringifyTarget: any): string {
  return JSON.stringify(stringifyTarget, (key, value) => {
    if (typeof value === 'bigint') {
      return String(value);
    }

    return value;
  });
}

export function removeTrailingSemicolon(str: string): string {
  if (!str.endsWith(';')) {
    return str;
  }

  return str.slice(0, Math.max(0, str.length - 1));
}

/**
 * Convert multi-line string into a singular string.
 *
 * Example: converting SQL statements as multi-line template literals
 *   and converting to a single-line statement for execution
 *
 * @param str any single-line or multi-line string
 * @returns single-line string
 */
export function toSingleLine(str: string): string {
  return str.split(/\s*?\n+\s+/).join(' ');
}
