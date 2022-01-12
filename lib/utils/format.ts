import _ from 'lodash';
import type { Model, ModelCtor } from '../..';
import { DataTypes, Op as operators } from '../..';
import { cloneDeep } from './object';

const SqlString = require('../sql-string');

const operatorsSet = new Set(Object.values(operators));

export function format(arr: unknown[], dialect: string): string {
  const timeZone = null;
  // Make a clone of the array beacuse format modifies the passed args
  return SqlString.format(arr[0], arr.slice(1), timeZone, dialect);
}

export function formatNamedParameters(
  sql: string,
  parameters: Record<string, unknown>,
  dialect: string
): string {
  return SqlString.formatNamedParameters(sql, parameters, null, dialect);
}

export type FinderOptions = {
  attributes?: any[];
  where?: any;
};
/* Expand and normalize finder options */
export function mapFinderOptions(
  options: FinderOptions,
  Model: ModelCtor<Model>
): FinderOptions {
  if (options.attributes && Array.isArray(options.attributes)) {
    options.attributes = Model._injectDependentVirtualAttributes(
      options.attributes
    );
    options.attributes = options.attributes?.filter(
      v => !Model._virtualAttributes.has(v)
    );
  }

  mapOptionFieldNames(options, Model);

  return options;
}

/* Used to map field names in attributes and where conditions */
export function mapOptionFieldNames(
  options: FinderOptions,
  Model: ModelCtor<Model>
): FinderOptions {
  if (Array.isArray(options.attributes)) {
    options.attributes = options.attributes.map(attr => {
      // Object lookups will force any variable to strings, we don't want that for special objects etc
      if (typeof attr !== 'string') return attr;
      // Map attributes to aliased syntax attributes
      if (
        Model.rawAttributes[attr] &&
        attr !== Model.rawAttributes[attr].field
      ) {
        return [Model.rawAttributes[attr].field, attr];
      }
      return attr;
    });
  }

  if (options.where && _.isPlainObject(options.where)) {
    options.where = mapWhereFieldNames(options.where, Model);
  }

  return options;
}

export function mapWhereFieldNames(attributes: any[], Model: ModelCtor<Model>) {
  if (attributes) {
    attributes = cloneDeep(attributes);
    getComplexKeys(attributes).forEach((attribute: any) => {
      const rawAttribute: any = Model.rawAttributes[attribute];

      if (rawAttribute && rawAttribute.field !== rawAttribute.fieldName) {
        attributes[rawAttribute.field] = attributes[attribute];
        delete attributes[attribute];
      }

      if (
        _.isPlainObject(attributes[attribute]) &&
        !(
          rawAttribute &&
          (rawAttribute.type instanceof DataTypes.HSTORE ||
            rawAttribute.type instanceof DataTypes.JSON)
        )
      ) {
        // Prevent renaming of HSTORE & JSON fields
        attributes[attribute] = mapOptionFieldNames(
          {
            where: attributes[attribute]
          },
          Model
        ).where;
      }

      if (Array.isArray(attributes[attribute])) {
        attributes[attribute].forEach((where: any, index: number) => {
          if (_.isPlainObject(where)) {
            attributes[attribute][index] = mapWhereFieldNames(where, Model);
          }
        });
      }
    });
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
  return getOperators(obj).concat(Object.keys(obj));
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

/* Used to map field names in values */
export function mapValueFieldNames(dataValues: any, fields: any, Model: any) {
  const values: { [key: string]: any } = {};

  for (const attr of fields) {
    if (dataValues[attr] !== undefined && !Model._virtualAttributes.has(attr)) {
      // Field name mapping
      if (
        Model.rawAttributes[attr] &&
        Model.rawAttributes[attr].field &&
        Model.rawAttributes[attr].field !== attr
      ) {
        values[Model.rawAttributes[attr].field] = dataValues[attr];
      } else {
        values[attr] = dataValues[attr];
      }
    }
  }

  return values;
}

export function removeNullValuesFromHash(
  hash: any,
  omitNull: boolean,
  options: { allowNull?: string[] } = {}
) {
  let result = hash;

  options.allowNull = options.allowNull || [];

  if (omitNull) {
    const _hash: { [key: string]: any } = {};

    _.forIn(hash, (val: any, key: string) => {
      if (
        options.allowNull?.includes(key) ||
        key.endsWith('Id') ||
        val !== null && val !== undefined
      ) {
        _hash[key] = val;
      }
    });

    result = _hash;
  }

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
  columnName: string
): string {
  return `enum_${tableName}_${columnName}`;
}
