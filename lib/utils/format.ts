import forIn from 'lodash/forIn';
import isPlainObject from 'lodash/isPlainObject';
import type { Model, ModelStatic, WhereOptions, ModelAttributeColumnOptions } from '../..';
// eslint-disable-next-line import/order -- caused by temporarily mixing require with import
import { Op as operators } from '../operators';

// eslint-disable-next-line @typescript-eslint/no-require-imports -- TODO (@AllAwesome497): .js files must be imported using require. Fix me once data-types has been migrated to TS.
const DataTypes = require('../data-types');
// eslint-disable-next-line @typescript-eslint/no-require-imports -- TODO: .js files must be imported using require. Fix me once sql-string has been migrated to TS.
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

/**
 * Expand and normalize finder options.
 * Mutates the "options" parameter.
 *
 * @param options
 * @param Model
 */
export function mapFinderOptions<M extends Model, T extends FinderOptions<M['_attributes']>>(
  options: T,
  Model: ModelStatic<Model>,
): MappedFinderOptions<M['_attributes']> {
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
 * Mutates the "options" parameter.
 *
 * @param options
 * @param Model
 */
export function mapOptionFieldNames<M extends Model>(
  options: FinderOptions<M['_attributes']>,
  Model: ModelStatic<Model>,
): MappedFinderOptions<M['_attributes']> {
  const out: MappedFinderOptions<M['_attributes']> = options;

  if (Array.isArray(options.attributes)) {
    out.attributes = options.attributes.map(attributeName => {
      // Object lookups will force any variable to strings, we don't want that for special objects etc
      if (typeof attributeName !== 'string') {
        return attributeName;
      }

      // Map attributes to column names
      const columnName: string | undefined = Model.rawAttributes[attributeName]?.field;
      if (columnName && columnName !== attributeName) {
        return [columnName, attributeName];
      }

      return attributeName;
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
  // TODO [2022-09-01]: note on 'as any[]': TypeScript < 4.4 does not support using Symbol for keys.
  //  Cast can be removed in sept. 2022 when we drop support for < 4.4
  for (const attributeNameOrOperator of getComplexKeys(where) as any[]) {
    const rawAttribute: ModelAttributeColumnOptions | undefined = Model.rawAttributes[attributeNameOrOperator];

    // TODO [2022-09-01]: note on 'any': TypeScript < 4.4 does not support using Symbol for keys.
    //  Cast can changed back to 'symbol | string' in sept. 2022 when we drop support for < 4.4
    const columnNameOrOperator: any = rawAttribute?.field ?? attributeNameOrOperator;

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
export function mapValueFieldNames( // TODO: rename to mapAttributesToColumNames? See https://github.com/sequelize/meetings/issues/17
  dataValues: Record<string, any>,
  attributeNames: string[],
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

/**
 * Removes entries from `hash` whose value is either null or undefined, unless `omitNull` is false or `allowNull` includes that key.
 *
 * Keys ending with 'Id' are never removed.
 *
 * @param hash the object from which entries with nullish values will be removed.
 * @param omitNull if false, this method returns the object as-is
 * @param options
 * @param options.allowNull A list of keys that must be preserved even if their value is null or undefined.
 * @returns {Record<string, any>}
 */
export function removeNullishValuesFromHash(
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
