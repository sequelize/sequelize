import forIn from 'lodash/forIn';
import isPlainObject from 'lodash/isPlainObject';
import type { Model, ModelStatic, WhereOptions, ModelAttributeColumnOptions } from '../..';
import { DataTypes } from '../..';
// eslint-disable-next-line import/order
import { Op as operators } from '../operators';

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

export type MappedFinderOptions<TAttributes> = Omit<FinderOptions<TAttributes>, 'attributes'> & {
  // an array of attribute-column mapping, or just attributes
  attributes?: Array<[columnName: string, attributeName: string] | string>,
};

/* Expand and normalize finder options */
export function mapFinderOptions<M extends Model, T extends FinderOptions<M['_attributes']>>(
  options: T,
  Model: ModelStatic<Model>,
): T {
  if (Array.isArray(options.attributes)) {
    options.attributes = Model._injectDependentVirtualAttributes(
      options.attributes,
    );

    options.attributes = options.attributes.filter(
      v => !Model._virtualAttributes.has(v),
    );
  }

  mapOptionFieldNames(options, Model);

  return options;
}

/**
 * Used to map field names in attributes and where conditions.
 *
 * @param options
 * @param Model
 */
export function mapOptionFieldNames<M extends Model, T extends FinderOptions<M['_attributes']>>(
  options: T,
  Model: ModelStatic<Model>,
): MappedFinderOptions<M['_attributes']> {
  const out: MappedFinderOptions<M['_attributes']> = { ...options };

  if (Array.isArray(options.attributes)) {
    out.attributes = options.attributes.map(attr => {
      // Object lookups will force any variable to strings, we don't want that for special objects etc
      if (typeof attr !== 'string') {
        return attr;
      }

      // Map attributes to column names
      const columnName = Model.rawAttributes[attr]?.field;
      if (columnName) {
        return [columnName, attr];
      }

      return attr;
    });
  }

  if (options.where != null && isPlainObject(options.where)) {
    out.where = mapWhereFieldNames(options.where, Model);
  }

  return out;
}

export function mapWhereFieldNames(where: Record<string | symbol, any>, Model: ModelStatic<Model>): object {
  if (!where) {
    return where;
  }

  const newAttributes: Record<string | symbol, any> = Object.create(null);
  for (const attributeNameOrOperator of getComplexKeys(where)) {
    const rawAttribute: ModelAttributeColumnOptions | undefined = Model.rawAttributes[attributeNameOrOperator as any];

    const columnNameOrOperator: string | symbol = rawAttribute?.field ?? attributeNameOrOperator;

    if (
      isPlainObject(where[attributeNameOrOperator])
        && !(
          rawAttribute
          && (rawAttribute.type instanceof DataTypes.HSTORE
            || rawAttribute.type instanceof DataTypes.JSON)
        )
    ) {
      // Prevent renaming of HSTORE & JSON fields
      newAttributes[columnNameOrOperator] = mapOptionFieldNames(
        {
          where: where[attributeNameOrOperator],
        },
        Model,
      ).where;

      continue;
    }

    if (Array.isArray(where[attributeNameOrOperator])) {
      newAttributes[attributeNameOrOperator] = [...where[attributeNameOrOperator]];

      for (const [index, wherePart] of where[attributeNameOrOperator].entries()) {
        if (isPlainObject(wherePart)) {
          newAttributes[columnNameOrOperator][index] = mapWhereFieldNames(wherePart, Model);
        }
      }

      continue;
    }

    newAttributes[columnNameOrOperator] = where[attributeNameOrOperator];
  }

  return newAttributes;
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
