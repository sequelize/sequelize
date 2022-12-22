import assert from 'node:assert';
import forIn from 'lodash/forIn';
import isPlainObject from 'lodash/isPlainObject';
import type {
  Attributes,
  NormalizedAttributeOptions,
  Model,
  ModelStatic,
  WhereOptions,
} from '..';
import * as DataTypes from '../data-types';
import { Op as operators } from '../operators';
import { isString } from './check.js';

const operatorsSet = new Set(Object.values(operators));

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
export function mapFinderOptions<M extends Model, T extends FinderOptions<Attributes<M>>>(
  options: T,
  Model: ModelStatic<M>,
): MappedFinderOptions<Attributes<M>> {
  if (Array.isArray(options.attributes)) {
    options.attributes = Model._injectDependentVirtualAttributes(
      options.attributes,
    );

    const modelDefinition = Model.modelDefinition;
    options.attributes = options.attributes.filter(
      attributeName => !modelDefinition.virtualAttributeNames.has(attributeName),
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
  options: FinderOptions<Attributes<M>>,
  Model: ModelStatic,
): MappedFinderOptions<Attributes<M>> {

  // note: parts of Sequelize rely on this function mutating its inputs.
  //  be aware that these places need to be fixed before trying to make this a pure function.
  //  - ephys

  const out: MappedFinderOptions<Attributes<M>> = options;

  if (Array.isArray(options.attributes)) {
    out.attributes = options.attributes.map(attributeName => {
      // Object lookups will force any variable to strings, we don't want that for special objects etc
      if (typeof attributeName !== 'string') {
        return attributeName;
      }

      // Map attributes to column names
      const columnName: string = Model.modelDefinition.getColumnNameLoose(attributeName);
      if (columnName !== attributeName) {
        return [columnName, attributeName];
      }

      return attributeName;
    });
  }

  if (options.where != null && isPlainObject(options.where)) {
    // eslint-disable-next-line @typescript-eslint/prefer-ts-expect-error -- this fails in TS 4.4 and up, but not before
    // @ts-ignore the work necessary to type the return type of mapWhereFieldNames is not worth it
    out.where = mapWhereFieldNames(options.where, Model);
  }

  return out;
}

export function mapWhereFieldNames(where: Record<PropertyKey, any>, Model: ModelStatic<Model>): object {
  if (!where) {
    return where;
  }

  const modelDefinition = Model.modelDefinition;

  const newWhere: Record<PropertyKey, any> = Object.create(null);
  for (const attributeNameOrOperator of getComplexKeys(where)) {
    const rawAttribute: NormalizedAttributeOptions | undefined = isString(attributeNameOrOperator)
      ? modelDefinition.attributes.get(attributeNameOrOperator)
      : undefined;

    const columnNameOrOperator: PropertyKey = rawAttribute?.field ?? attributeNameOrOperator;

    if (
      isPlainObject(where[attributeNameOrOperator])
        && !(
          rawAttribute
          && (rawAttribute.type instanceof DataTypes.HSTORE
            || rawAttribute.type instanceof DataTypes.JSON)
        )
    ) {
      // Prevent renaming of HSTORE & JSON fields
      newWhere[columnNameOrOperator] = mapOptionFieldNames(
        {
          where: where[attributeNameOrOperator],
        },
        Model,
      ).where;

      continue;
    }

    if (Array.isArray(where[attributeNameOrOperator])) {
      newWhere[columnNameOrOperator] = [...where[attributeNameOrOperator]];

      for (const [index, wherePart] of where[attributeNameOrOperator].entries()) {
        if (isPlainObject(wherePart)) {
          newWhere[columnNameOrOperator][index] = mapWhereFieldNames(wherePart, Model);
        }
      }

      continue;
    }

    newWhere[columnNameOrOperator] = where[attributeNameOrOperator];
  }

  return newWhere;
}

/**
 * getComplexKeys
 *
 * @param obj
 * @returns All keys including operators
 * @private
 */
export function getComplexKeys(obj: object): Array<string | symbol> {
  return [
    ...getOperators(obj),
    ...Object.keys(obj),
  ];
}

/**
 * getComplexSize
 *
 * @param obj
 * @returns Length of object properties including operators if obj is array returns its length
 * @private
 */
export function getComplexSize(obj: object | any[]): number {
  return Array.isArray(obj) ? obj.length : getComplexKeys(obj).length;
}

/**
 * getOperators
 *
 * @param obj
 * @returns All operators properties of obj
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
  attributeNames: Iterable<string>,
  ModelClass: ModelStatic,
): Record<string, any> {
  const values: Record<string, any> = Object.create(null);
  const modelDefinition = ModelClass.modelDefinition;

  for (const attributeName of attributeNames) {
    if (dataValues[attributeName] !== undefined && !modelDefinition.virtualAttributeNames.has(attributeName)) {
      // Field name mapping
      const columnName = modelDefinition.getColumnNameLoose(attributeName);

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

export function getColumnName(attribute: NormalizedAttributeOptions): string {
  assert(attribute.fieldName != null, 'getColumnName expects a normalized attribute meta');

  // field is the column name alias
  // if no alias is set, fieldName (the JS name) will be used instead.
  return attribute.field || attribute.fieldName;
}

export function getAttributeName(model: ModelStatic, columnName: string): string | null {
  return Object.values(model.getAttributes()).find(attribute => attribute.field === columnName)?.fieldName ?? null;
}
