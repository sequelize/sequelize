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
 * @param {object} index
 * @param {Array}  index.fields
 * @param {string} [index.name]
 * @param {string|object} tableName
 *
 * @returns {object}
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
