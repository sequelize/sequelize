import forIn from 'lodash/forIn';
import isPlainObject from 'lodash/isPlainObject';
import type { Model, ModelStatic, WhereOptions } from '../..';
import { DataTypes, Op as operators } from '../..';
// eslint-disable-next-line import/order
import { cloneDeep } from './object';

// eslint-disable-next-line @typescript-eslint/no-require-imports -- .js files must be imported using require
const SqlString = require('../sql-string');

const operatorsSet = new Set(Object.values(operators));

export function format(arr: unknown[], dialect: string): string {
  const timeZone = null;

  // Make a clone of the array because format modifies the passed args
  return SqlString.format(arr[0], arr.slice(1), timeZone, dialect);
}

export function formatNamedParameters(
  sql: string,
  parameters: Record<string, unknown>,
  dialect: string,
): string {
  return SqlString.formatNamedParameters(sql, parameters, null, dialect);
}

export type FinderOptions<TAttributes> = {
  attributes?: string[],
  where?: WhereOptions<TAttributes>,
};

/* Expand and normalize finder options */
export function mapFinderOptions<M extends Model, T extends FinderOptions<M['_attributes']>>(
  options: T,
  Model: ModelStatic<Model>,
): T {
  if (options.attributes && Array.isArray(options.attributes)) {
    options.attributes = Model._injectDependentVirtualAttributes(
      options.attributes,
    );
    options.attributes = options.attributes?.filter(
      v => !Model._virtualAttributes.has(v),
    );
  }

  mapOptionFieldNames(options, Model);

  return options;
}

/* Used to map field names in attributes and where conditions */
export function mapOptionFieldNames<M extends Model, T extends FinderOptions<M['_attributes']>>(
  options: T,
  Model: ModelStatic<Model>,
): T {
  if (Array.isArray(options.attributes)) {
    options.attributes = options.attributes.map(attr => {
      // Object lookups will force any variable to strings, we don't want that for special objects etc
      if (typeof attr !== 'string') {
        return attr;
      }

      // Map attributes to aliased syntax attributes
      if (
        Model.rawAttributes[attr]
        && attr !== Model.rawAttributes[attr].field
      ) {
        return [Model.rawAttributes[attr].field, attr];
      }

      return attr;
    });
  }

  if (options.where && isPlainObject(options.where)) {
    options.where = mapWhereFieldNames(options.where, Model);
  }

  return options;
}

export function mapWhereFieldNames(attributes: object, Model: ModelStatic<Model>): object {
  if (!attributes) {
    return attributes;
  }

  attributes = cloneDeep(attributes);
  for (const attributeName of getComplexKeys(attributes)) {
    const rawAttribute: any = Model.rawAttributes[attributeName as any];

    if (rawAttribute && rawAttribute.field !== rawAttribute.fieldName) {
      attributes[rawAttribute.field] = attributes[attributeName];
      delete attributes[attributeName];
    }

    if (
      isPlainObject(attributes[attributeName])
        && !(
          rawAttribute
          && (rawAttribute.type instanceof DataTypes.HSTORE
            || rawAttribute.type instanceof DataTypes.JSON)
        )
    ) {
      // Prevent renaming of HSTORE & JSON fields
      attributes[attributeName] = mapOptionFieldNames(
        {
          where: attributes[attributeName],
        },
        Model,
      ).where;
    }

    if (Array.isArray(attributes[attributeName])) {
      for (let i = 0; i < attributes.length; i++) {
        const where = attributes[i];

        if (isPlainObject(where)) {
          attributes[attributeName][i] = mapWhereFieldNames(where, Model);
        }
      }
    }
  }

  return attributes;
}

/**
 * getComplexKeys
 *
 * @param  {object} obj
 * @returns {Array<string|symbol>} All keys including operators
 * @private
 */
export function getComplexKeys(obj: object): Array<string | symbol> {
  return [
    ...getOperators(obj),
    ...Object.keys(obj),
  ];
}

/**
 * getOperators
 *
 * @param  {object} obj
 * @returns {Array<symbol|string>} All operators properties of obj
 * @private
 */
export function getOperators(obj: object): symbol[] {
  return Object.getOwnPropertySymbols(obj).filter(s => operatorsSet.has(s));
}

export function combineTableNames(tableName1: string, tableName2: string): string {
  return tableName1.toLowerCase() < tableName2.toLowerCase()
    ? tableName1 + tableName2
    : tableName2 + tableName1;
}

/**
 * Used to map field names in values
 *
 * @param dataValues
 * @param attributeNames
 * @param ModelClass
 */
export function mapValueFieldNames( // TODO: rename to mapAttributesToColumNames?
  dataValues: Record<string, any>,
  attributeNames: string[], // TODO: can attributes be symbols too?
  ModelClass: ModelStatic<Model>,
): Record<string, any> {
  const values: Record<string, any> = Object.create(null);

  for (const attributeName of attributeNames) {
    if (dataValues[attributeName] !== undefined && !ModelClass._virtualAttributes.has(attributeName)) {
      // Field name mapping
      const columnName = ModelClass.rawAttributes[attributeName]?.field ?? attributeName;

      values[columnName] = dataValues[attributeName];
    }
  }

  return values;
}

// TODO: rename to removeNullishValues as it also removes undefined.
export function removeNullValuesFromHash(
  hash: Record<string, any>,
  omitNull: boolean,
  options?: { allowNull?: string[] },
): Record<string, any> {
  let result = hash;

  const allowNull = options?.allowNull ?? [];

  if (!omitNull) {
    return result;
  }

  const _hash: { [key: string]: any } = Object.create(null);

  forIn(hash, (val: any, key: string) => {
    if (
      allowNull.includes(key)
        || key.endsWith('Id')
        || val !== null && val !== undefined
    ) {
      _hash[key] = val;
    }
  });

  result = _hash;

  return result;
}

/**
 * Returns ENUM name by joining table and column name
 *
 * @param {string} tableName
 * @param {string} columnName
 * @returns {string}
 * @private
 */
export function generateEnumName(
  tableName: string,
  columnName: string,
): string {
  return `enum_${tableName}_${columnName}`;
}
