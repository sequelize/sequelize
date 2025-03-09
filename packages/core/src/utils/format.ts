import forIn from 'lodash/forIn';
import assert from 'node:assert';
import type { Attributes, Model, ModelStatic, NormalizedAttributeOptions, WhereOptions } from '..';

export type FinderOptions<TAttributes> = {
  attributes?: string[];
  where?: WhereOptions<TAttributes>;
};

export type MappedFinderOptions<TAttributes> = Omit<FinderOptions<TAttributes>, 'attributes'> & {
  // an array of attribute-column mapping, or just attributes
  attributes?: Array<[columnName: string, attributeName: string] | string>;
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
    options.attributes = Model._injectDependentVirtualAttributes(options.attributes);

    const modelDefinition = Model.modelDefinition;
    options.attributes = options.attributes.filter(
      attributeName => !modelDefinition.virtualAttributeNames.has(attributeName),
    );
  }

  mapOptionFieldNames(options, Model);

  return options;
}

/**
 * Used to map field names in attributes
 *
 * Mutates the "options" parameter.
 *
 * ⚠️ This function does not map the "where" or "having" options, this is handled by QueryGenerator's WHERE generation.
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

  return out;
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
    if (
      dataValues[attributeName] !== undefined &&
      !modelDefinition.virtualAttributeNames.has(attributeName)
    ) {
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
    if (allowNull.includes(key) || key.endsWith('Id') || (val !== null && val !== undefined)) {
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
  return (
    Object.values(model.getAttributes()).find(attribute => attribute.field === columnName)
      ?.fieldName ?? null
  );
}
