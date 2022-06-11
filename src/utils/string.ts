import NodeUtil from 'node:util';
import _inflection from 'inflection';
import type { IndexOptions, TableName } from '../dialects/abstract/query-interface.js';
import { SequelizeMethod } from './sequelize-method.js';

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
  tableName: TableName,
) {
  if (Object.prototype.hasOwnProperty.call(index, 'name')) {
    return index;
  }

  index.name = generateIndexName(tableName, index);

  return index;
}

export function generateIndexName(tableName: TableName, index: IndexOptions): string {
  if (typeof tableName !== 'string' && tableName.tableName) {
    tableName = tableName.tableName;
  }

  if (!index.fields) {
    throw new Error(`Index on table ${tableName} has not fields:
${NodeUtil.inspect(index)}`);
  }

  const fields = index.fields.map(field => {
    if (typeof field === 'string') {
      return field;
    }

    if (field instanceof SequelizeMethod) {
      // eslint-disable-next-line unicorn/prefer-type-error -- not a type error.
      throw new Error(`Index on table ${tableName} uses Sequelize's ${field.constructor.name} as one of its fields. You need to name this index manually.`);
    }

    if ('attribute' in field) {
      throw new Error('Property "attribute" in IndexField has been renamed to "name"');
    }

    return field.name;
  });

  let out = `${tableName}:${fields.join('+')}`;

  if (index.unique) {
    out += ':unique';
  }

  return out;
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
