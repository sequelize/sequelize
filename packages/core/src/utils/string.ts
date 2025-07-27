import * as _inflection from 'inflection';
import lowerFirst from 'lodash/lowerFirst';
import NodeUtil from 'node:util';
import type { IndexOptions, TableName } from '../abstract-dialect/query-interface.js';
import { BaseSqlExpression } from '../expression-builders/base-sql-expression.js';

/* Inflection */
type Inflection = typeof _inflection;

let inflection: Inflection = _inflection;

export function useInflection(newInflection: Inflection) {
  inflection = newInflection;
}

/* String utils */

export function camelize(str: string): string {
  return lowerFirst(str.trim()).replaceAll(/[-_\s]+(.)?/g, (match, c) => c.toUpperCase());
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

export function spliceStr(str: string, index: number, count: number, add: string): string {
  return str.slice(0, index) + add + str.slice(index + count);
}

export function singularize(str: string): string {
  return inflection.singularize(str);
}

export function pluralize(str: string): string {
  return inflection.pluralize(str);
}

type NameIndexIndex = {
  fields: Array<{ name: string; attribute: string }>;
  name: string;
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
export function nameIndex(index: NameIndexIndex, tableName: TableName) {
  if (Object.hasOwn(index, 'name')) {
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

    if (field instanceof BaseSqlExpression) {
      throw new Error(
        `Index on table ${tableName} uses Sequelize's ${field.constructor.name} as one of its fields. You need to name this index manually.`,
      );
    }

    if ('attribute' in field) {
      throw new Error('Property "attribute" in IndexField has been renamed to "name"');
    }

    return field.name;
  });

  let out = `${tableName}_${fields.join('_')}`;

  if (index.unique) {
    out += '_unique';
  }

  return underscore(out);
}

export function removeTrailingSemicolon(str: string): string {
  if (!str.endsWith(';')) {
    return str;
  }

  return str.slice(0, Math.max(0, str.length - 1));
}
