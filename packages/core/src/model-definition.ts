import { MapView, SetView, cloneDeepPlainValues, pojo, some } from '@sequelize/utils';
import isPlainObject from 'lodash/isPlainObject';
import omit from 'lodash/omit';
import NodeUtil from 'node:util';
import { isDataTypeClass } from './abstract-dialect/data-types-utils.js';
import { AbstractDataType } from './abstract-dialect/data-types.js';
import type { IndexOptions, TableNameWithSchema } from './abstract-dialect/query-interface.js';
import type { Association } from './associations/index.js';
import * as DataTypes from './data-types.js';
import { BaseError } from './errors/index.js';
import type { HookHandler } from './hooks.js';
import type { ModelHooks } from './model-hooks.js';
import { staticModelHooks } from './model-hooks.js';
import { conformIndex } from './model-internals.js';
import type {
  AttributeOptions,
  BuiltModelOptions,
  InitOptions,
  Model,
  ModelAttributes,
  ModelOptions,
  ModelStatic,
  NormalizedAttributeOptions,
  NormalizedAttributeReferencesOptions,
} from './model.js';
import type { Sequelize } from './sequelize.js';
import { fieldToColumn } from './utils/deprecations.js';
import { toDefaultValue } from './utils/dialect.js';
import { isModelStatic } from './utils/model-utils.js';
import { getAllOwnEntries, removeUndefined } from './utils/object.js';
import { generateIndexName, pluralize, underscoredIf } from './utils/string.js';

export interface TimestampAttributes {
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string;
}

/**
 * The goal of this class is to store the definition of a model.
 *
 * It is part of the Repository Design Pattern.
 * See https://github.com/sequelize/sequelize/issues/15389 for more details.
 *
 * There is only one ModelDefinition instance per model per sequelize instance.
 */
export class ModelDefinition<M extends Model = Model> {
  readonly #sequelize: Sequelize;
  readonly options: BuiltModelOptions;
  readonly #table: TableNameWithSchema;
  get table(): TableNameWithSchema {
    return this.#table;
  }

  readonly associations: { [associationName: string]: Association } = Object.create(null);

  /**
   * The list of attributes that have *not* been normalized.
   * This list can be mutated. Call {@link refreshAttributes} to update the normalized attributes ({@link attributes)}.
   */
  readonly rawAttributes: { [attributeName: string]: AttributeOptions<M> };

  readonly #attributes = new Map</* attribute name */ string, NormalizedAttributeOptions>();

  /**
   * The list of attributes that have been normalized.
   *
   * This map is fully frozen and cannot be modified directly.
   * Modify {@link rawAttributes} then call {@link refreshAttributes} instead.
   */
  readonly attributes = new MapView(this.#attributes);

  readonly #physicalAttributes = new Map</* attribute name */ string, NormalizedAttributeOptions>();

  /**
   * The list of attributes that actually exist in the database, as opposed to {@link virtualAttributeNames}.
   */
  readonly physicalAttributes = new MapView(this.#physicalAttributes);

  readonly #columns = new Map</* column name */ string, NormalizedAttributeOptions>();
  readonly columns = new MapView(this.#columns);

  readonly #primaryKeyAttributeNames = new Set<string>();

  readonly primaryKeysAttributeNames = new SetView(this.#primaryKeyAttributeNames);

  /**
   * List of attributes that cannot be modified by the user
   */
  readonly #readOnlyAttributeNames = new Set<string>();

  /**
   * List of attributes that cannot be modified by the user (read-only)
   */
  readonly readOnlyAttributeNames = new SetView(this.#readOnlyAttributeNames);

  /**
   * Records which attributes are the different built-in timestamp attributes
   */
  readonly timestampAttributeNames: TimestampAttributes = Object.create(null);

  /**
   * The name of the attribute that records the version of the model instance.
   */
  readonly #versionAttributeName: string | undefined;

  get versionAttributeName(): string | undefined {
    return this.#versionAttributeName;
  }

  readonly #jsonAttributeNames = new Set<string>();
  readonly jsonAttributeNames = new SetView(this.#jsonAttributeNames);

  readonly #virtualAttributeNames = new Set<string>();

  /**
   * The list of attributes that do not really exist in the database.
   */
  readonly virtualAttributeNames = new SetView(this.#virtualAttributeNames);

  readonly #attributesWithGetters = new Set<string>();
  readonly attributesWithGetters = new SetView(this.#attributesWithGetters);

  readonly #attributesWithSetters = new Set<string>();
  readonly attributesWithSetters = new SetView(this.#attributesWithSetters);

  /**
   * @deprecated Code should not rely on this as users can create custom attributes.
   */
  readonly #booleanAttributeNames = new Set<string>();

  /**
   * @deprecated Code should not rely on this as users can create custom attributes.
   */
  readonly booleanAttributeNames = new SetView(this.#booleanAttributeNames);

  /**
   * @deprecated Code should not rely on this as users can create custom attributes.
   */
  readonly #dateAttributeNames = new Set<string>();

  /**
   * @deprecated Code should not rely on this as users can create custom attributes.
   */
  readonly dateAttributeNames = new SetView(this.#dateAttributeNames);

  #autoIncrementAttributeName: string | null = null;
  get autoIncrementAttributeName(): string | null {
    return this.#autoIncrementAttributeName;
  }

  readonly #defaultValues = new Map</* attribute name */ string, () => unknown>();
  readonly defaultValues = new MapView(this.#defaultValues);

  /**
   * Final list of indexes, built by refreshIndexes
   */
  #indexes: IndexOptions[] = [];

  // TODO: associated model can be any class, not just ModelStatic.
  readonly model: ModelStatic<M>;

  get modelName(): string {
    return this.options.modelName;
  }

  get underscored(): boolean {
    return this.options.underscored;
  }

  get sequelize(): Sequelize {
    return this.#sequelize;
  }

  // TODO: add generic type to ModelHooks (model, attributes)
  get hooks(): HookHandler<ModelHooks> {
    return staticModelHooks.getFor(this);
  }

  constructor(
    attributesOptions: ModelAttributes<M>,
    modelOptions: InitOptions<M>,
    model: ModelStatic<M>,
  ) {
    if (!modelOptions.sequelize) {
      throw new Error(
        'new ModelDefinition() expects a Sequelize instance to be passed through the option bag, which is the second parameter.',
      );
    }

    if (!modelOptions.modelName) {
      throw new Error(
        'new ModelDefinition() expects a modelName to be passed through the option bag, which is the second parameter.',
      );
    }

    this.#sequelize = modelOptions.sequelize;
    this.model = model;

    const globalOptions = this.#sequelize.options;

    // TODO: deep freeze this.options
    // caution: mergeModelOptions mutates its first input
    const validate = {} satisfies ModelOptions<M>['validate'];
    this.options = mergeModelOptions<M>(
      // default options
      {
        noPrimaryKey: false,
        timestamps: true,
        validate,
        freezeTableName: false,
        underscored: false,
        paranoid: false,
        schema: '',
        schemaDelimiter: '',
        defaultScope: {},
        scopes: {},
        name: {},
        indexes: [],
        ...cloneDeepPlainValues(globalOptions.define, true),
      },
      removeUndefined(modelOptions),
      true,
    ) as BuiltModelOptions;

    // @ts-expect-error -- guide to help users migrate to alternatives, these were deprecated in v6
    if (this.options.getterMethods || this.options.setterMethods) {
      throw new Error(`Error in the definition of Model ${this.modelName}: The "getterMethods" and "setterMethods" options have been removed.

If you need to use getters & setters that behave like attributes, use VIRTUAL attributes.
If you need regular getters & setters, define your model as a class and add getter & setters.
See https://sequelize.org/docs/v6/core-concepts/getters-setters-virtuals/#deprecated-in-sequelize-v7-gettermethods-and-settermethods for more information.`);
    }

    this.options.name.plural ??= pluralize(this.options.modelName);
    // Model Names must be singular!
    this.options.name.singular ??= this.options.modelName;

    this.#sequelize.hooks.runSync('beforeDefine', attributesOptions, this.options);

    if (this.options.hooks) {
      this.hooks.addListeners(this.options.hooks);
    }

    if (!this.options.tableName) {
      this.options.tableName = this.options.freezeTableName
        ? this.modelName
        : underscoredIf(this.options.name.plural, this.underscored);
    }

    this.#table = Object.freeze(
      this.sequelize.queryGenerator.extractTableDetails(
        removeUndefined({
          tableName: this.options.tableName,
          schema: this.options.schema,
          delimiter: this.options.schemaDelimiter,
        }),
      ),
    );

    // error check options
    for (const [validatorName, validator] of getAllOwnEntries(this.options.validate)) {
      if (typeof validator !== 'function') {
        throw new TypeError(
          `Members of the validate option must be functions. Model: ${this.modelName}, error with validate member ${String(validatorName)}`,
        );
      }
    }

    // attributes that will be added at the start of this.rawAttributes (id)
    const rawAttributes: { [attributeName: string]: AttributeOptions<M> } = Object.create(null);

    for (const [attributeName, rawAttributeOrDataType] of getAllOwnEntries(attributesOptions)) {
      if (typeof attributeName === 'symbol') {
        throw new TypeError('Symbol attributes are not supported');
      }

      let rawAttribute: AttributeOptions<M>;
      try {
        rawAttribute = this.sequelize.normalizeAttribute(rawAttributeOrDataType);
      } catch (error) {
        throw new BaseError(
          `An error occurred for attribute ${attributeName} on model ${this.modelName}.`,
          { cause: error },
        );
      }

      rawAttributes[attributeName] = rawAttribute;

      if (rawAttribute.field) {
        fieldToColumn();
      }
    }

    // setup names of timestamp attributes
    if (this.options.timestamps) {
      for (const key of ['createdAt', 'updatedAt', 'deletedAt'] as const) {
        if (!['undefined', 'string', 'boolean'].includes(typeof this.options[key])) {
          throw new Error(
            `Value for "${key}" option must be a string or a boolean, got ${typeof this.options[key]}`,
          );
        }

        if (this.options[key] === '') {
          throw new Error(`Value for "${key}" option cannot be an empty string`);
        }
      }

      if (this.options.createdAt !== false) {
        this.timestampAttributeNames.createdAt =
          typeof this.options.createdAt === 'string' ? this.options.createdAt : 'createdAt';

        this.#readOnlyAttributeNames.add(this.timestampAttributeNames.createdAt);
      }

      if (this.options.updatedAt !== false) {
        this.timestampAttributeNames.updatedAt =
          typeof this.options.updatedAt === 'string' ? this.options.updatedAt : 'updatedAt';
        this.#readOnlyAttributeNames.add(this.timestampAttributeNames.updatedAt);
      }

      if (this.options.paranoid && this.options.deletedAt !== false) {
        this.timestampAttributeNames.deletedAt =
          typeof this.options.deletedAt === 'string' ? this.options.deletedAt : 'deletedAt';

        this.#readOnlyAttributeNames.add(this.timestampAttributeNames.deletedAt);
      }
    }

    // setup name for version attribute
    if (this.options.version) {
      this.#versionAttributeName =
        typeof this.options.version === 'string' ? this.options.version : 'version';
      this.#readOnlyAttributeNames.add(this.#versionAttributeName);
    }

    this.rawAttributes = Object.create(null);

    // Add id if no primary key was manually added to definition
    if (
      !this.options.noPrimaryKey &&
      !some(Object.values(rawAttributes), attr => Boolean(attr.primaryKey))
    ) {
      if ('id' in rawAttributes && rawAttributes.id?.primaryKey === undefined) {
        throw new Error(
          `An attribute called 'id' was defined in model '${this.options.tableName}' but primaryKey is not set. This is likely to be an error, which can be fixed by setting its 'primaryKey' option to true. If this is intended, explicitly set its 'primaryKey' option to false`,
        );
      }

      // add PK first  for a clean attribute order
      this.rawAttributes.id = {
        type: DataTypes.INTEGER(),
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
        _autoGenerated: true,
      };
    }

    // add all user defined attributes

    for (const [attributeName, rawAttribute] of Object.entries(rawAttributes)) {
      this.rawAttributes[attributeName] = rawAttribute;
    }

    // add timestamp & version last for a clean attribute order

    if (this.timestampAttributeNames.createdAt) {
      this.#addTimestampAttribute(this.timestampAttributeNames.createdAt, false);
    }

    if (this.timestampAttributeNames.updatedAt) {
      this.#addTimestampAttribute(this.timestampAttributeNames.updatedAt, false);
    }

    if (this.timestampAttributeNames.deletedAt) {
      this.#addTimestampAttribute(this.timestampAttributeNames.deletedAt, true);
    }

    if (this.#versionAttributeName) {
      const existingAttribute: AttributeOptions<M> | undefined =
        this.rawAttributes[this.#versionAttributeName];

      if (existingAttribute?.type && !(existingAttribute.type instanceof DataTypes.INTEGER)) {
        throw new Error(`Sequelize is trying to add the version attribute ${NodeUtil.inspect(this.#versionAttributeName)} to Model ${NodeUtil.inspect(this.modelName)},
but an attribute with the same name already exists and declares a data type.
The "version" attribute is managed automatically by Sequelize, and its type must be DataTypes.INTEGER. Please either:
- remove the "type" property from your attribute definition,
- rename either your attribute or the version attribute,
- or disable the automatic timestamp attributes.`);
      }

      if (existingAttribute?.allowNull === true) {
        throw new Error(`Sequelize is trying to add the timestamp attribute ${NodeUtil.inspect(this.#versionAttributeName)} to Model ${NodeUtil.inspect(this.modelName)},
but an attribute with the same name already exists and its allowNull option (${existingAttribute.allowNull}) conflicts with the one Sequelize is trying to set (false).
The "version" attribute is managed automatically by Sequelize, and its nullability is not configurable. Please either:
- remove the "allowNull" property from your attribute definition,
- rename either your attribute or the version attribute,
- or disable the automatic version attribute.`);
      }

      this.rawAttributes[this.#versionAttributeName] = {
        ...existingAttribute,
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        _autoGenerated: true,
      };
    }

    this.refreshAttributes();
  }

  #addTimestampAttribute(attributeName: string, allowNull: boolean) {
    const existingAttribute: AttributeOptions<M> | undefined = this.rawAttributes[attributeName];

    if (existingAttribute?.type && !(existingAttribute.type instanceof DataTypes.DATE)) {
      throw new Error(`Sequelize is trying to add the timestamp attribute ${NodeUtil.inspect(attributeName)} to Model ${NodeUtil.inspect(this.modelName)},
but an attribute with the same name already exists and declares a data type.
Timestamp attributes are managed automatically by Sequelize, and their data type must be DataTypes.DATE (https://github.com/sequelize/sequelize/issues/2572). Please either:
- remove the "type" property from your attribute definition,
- rename either your attribute or the timestamp attribute,
- or disable the automatic timestamp attributes.`);
    }

    if (existingAttribute?.allowNull != null && existingAttribute?.allowNull !== allowNull) {
      throw new Error(`Sequelize is trying to add the timestamp attribute ${NodeUtil.inspect(attributeName)} to Model ${NodeUtil.inspect(this.modelName)},
but an attribute with the same name already exists and its allowNull option (${existingAttribute.allowNull}) conflicts with the one Sequelize is trying to set (${allowNull}).
Timestamp attributes are managed automatically by Sequelize, and their nullability is not configurable. Please either:
- remove the "allowNull" property from your attribute definition,
- rename either your attribute or the timestamp attribute,
- or disable the automatic timestamp attributes.`);
    }

    const { defaultTimestampPrecision } = this.#sequelize.options;

    this.rawAttributes[attributeName] = {
      // @ts-expect-error -- this property is not mandatory in timestamp attributes
      type:
        typeof defaultTimestampPrecision === 'number'
          ? DataTypes.DATE(defaultTimestampPrecision)
          : DataTypes.DATE,
      ...this.rawAttributes[attributeName],
      allowNull,
      _autoGenerated: true,
    };
  }

  /**
   * Normalizes all attribute definitions, using {@link rawAttributes} as the source.
   */
  refreshAttributes() {
    this.hooks.runSync('beforeDefinitionRefresh');

    this.#attributes.clear();
    this.#booleanAttributeNames.clear();
    this.#dateAttributeNames.clear();
    this.#jsonAttributeNames.clear();
    this.#virtualAttributeNames.clear();
    this.#physicalAttributes.clear();
    this.#defaultValues.clear();
    this.#columns.clear();
    this.#primaryKeyAttributeNames.clear();
    this.#autoIncrementAttributeName = null;
    this.#attributesWithGetters.clear();
    this.#attributesWithSetters.clear();

    // indexes defined through attributes
    const attributeIndexes: IndexOptions[] = [];

    for (const [attributeName, rawAttribute] of Object.entries(this.rawAttributes)) {
      if (typeof attributeName !== 'string') {
        throw new TypeError(
          `Attribute names must be strings, but "${this.modelName}" declared a non-string attribute: ${NodeUtil.inspect(attributeName)}`,
        );
      }

      // Checks whether the name is ambiguous with isColString
      // we check whether the attribute starts *or* ends because the following query:
      // { '$json.key$' }
      // could be interpreted as both
      // "json"."key" (accessible attribute 'key' on model 'json')
      // or
      // "$json" #>> {key$} (accessing key 'key$' on attribute '$json')
      if (attributeName.startsWith('$') || attributeName.endsWith('$')) {
        throw new Error(
          `Name of attribute "${attributeName}" in model "${this.modelName}" cannot start or end with "$" as "$attribute$" is reserved syntax used to reference nested columns in queries.`,
        );
      }

      if (attributeName.includes('.')) {
        throw new Error(
          `Name of attribute "${attributeName}" in model "${this.modelName}" cannot include the character "." as it would be ambiguous with the syntax used to reference nested columns, and nested json keys, in queries.`,
        );
      }

      if (attributeName.includes('::')) {
        throw new Error(
          `Name of attribute "${attributeName}" in model "${this.modelName}" cannot include the character sequence "::" as it is reserved syntax used to cast attributes in queries.`,
        );
      }

      if (attributeName.includes('->')) {
        throw new Error(
          `Name of attribute "${attributeName}" in model "${this.modelName}" cannot include the character sequence "->" as it is reserved syntax used in SQL generated by Sequelize to target nested associations.`,
        );
      }

      if (!isPlainObject(rawAttribute)) {
        throw new Error(
          `Attribute "${this.modelName}.${attributeName}" must be specified as a plain object.`,
        );
      }

      if (!rawAttribute.type) {
        throw new Error(
          `Attribute "${this.modelName}.${attributeName}" does not specify its DataType.`,
        );
      }

      try {
        const columnName =
          rawAttribute.columnName ??
          rawAttribute.field ??
          underscoredIf(attributeName, this.underscored);

        const builtAttribute = pojo<NormalizedAttributeOptions>({
          ...omit(rawAttribute, ['unique', 'index']),
          type: this.#sequelize.normalizeDataType(rawAttribute.type),
          references: normalizeReference(rawAttribute.references),

          // fieldName is a legacy name, renamed to attributeName.
          fieldName: attributeName,
          attributeName,

          // field is a legacy name, renamed to columnName.
          field: columnName,
          columnName,

          // @ts-expect-error -- undocumented legacy property, to be removed.
          Model: this.model,

          // undocumented legacy property, to be removed.
          _modelAttribute: true,
        });

        if (builtAttribute.type instanceof AbstractDataType) {
          // @ts-expect-error -- defaultValue is not readOnly yet!
          builtAttribute.type = builtAttribute.type.withUsageContext({
            // TODO: Repository Pattern - replace with ModelDefinition
            model: this.model,
            attributeName,
            sequelize: this.sequelize,
          });
        }

        if (Object.hasOwn(builtAttribute, 'defaultValue')) {
          if (isDataTypeClass(builtAttribute.defaultValue)) {
            // @ts-expect-error -- defaultValue is not readOnly yet!
            builtAttribute.defaultValue = new builtAttribute.defaultValue();
          }

          this.#defaultValues.set(attributeName, () => toDefaultValue(builtAttribute.defaultValue));
        }

        // TODO: remove "notNull" & "isNull" validators
        if (rawAttribute.allowNull !== false && rawAttribute.validate?.notNull) {
          throw new Error(`"notNull" validator is only allowed with "allowNull:false"`);
        }

        if (builtAttribute.primaryKey === true) {
          this.#primaryKeyAttributeNames.add(attributeName);
        }

        if (builtAttribute.type instanceof DataTypes.BOOLEAN) {
          this.#booleanAttributeNames.add(attributeName);
        } else if (
          builtAttribute.type instanceof DataTypes.DATE ||
          rawAttribute.type instanceof DataTypes.DATEONLY
        ) {
          this.#dateAttributeNames.add(attributeName);
        } else if (builtAttribute.type instanceof DataTypes.JSON) {
          this.#jsonAttributeNames.add(attributeName);
        }

        if (Object.hasOwn(rawAttribute, 'unique') && rawAttribute.unique) {
          const uniqueIndexes = Array.isArray(rawAttribute.unique)
            ? rawAttribute.unique
            : [rawAttribute.unique];

          for (const uniqueIndex of uniqueIndexes) {
            if (uniqueIndex === true || typeof uniqueIndex === 'string') {
              attributeIndexes.push({
                unique: true,
                fields: [builtAttribute.columnName],
                ...(typeof uniqueIndex === 'string' ? { name: uniqueIndex } : undefined),
              });
            } else {
              attributeIndexes.push({
                ...uniqueIndex,
                unique: true,
                fields: [builtAttribute.columnName],
              });
            }
          }
        }

        if (Object.hasOwn(rawAttribute, 'index') && rawAttribute.index) {
          const indexes = Array.isArray(rawAttribute.index)
            ? rawAttribute.index
            : [rawAttribute.index];

          for (const index of indexes) {
            const jsonbIndexDefaults =
              rawAttribute.type instanceof DataTypes.JSONB ? { using: 'gin' } : undefined;

            if (!index) {
              continue;
            }

            if (index === true || typeof index === 'string') {
              attributeIndexes.push({
                fields: [builtAttribute.columnName],
                ...(typeof index === 'string' ? { name: index } : undefined),
                ...jsonbIndexDefaults,
              });
            } else {
              // @ts-expect-error -- forbidden property
              if (index.fields) {
                throw new Error(
                  '"fields" cannot be specified for indexes defined on attributes. Use the "indexes" option on the table definition instead. You can also customize how this attribute is part of the index by specifying the "attribute" option on the index.',
                );
              }

              const { attribute: indexAttributeOptions, ...indexOptions } = index;

              attributeIndexes.push({
                ...jsonbIndexDefaults,
                ...indexOptions,
                fields: [
                  indexAttributeOptions
                    ? {
                        ...indexAttributeOptions,
                        name: builtAttribute.columnName,
                      }
                    : builtAttribute.columnName,
                ],
              });
            }
          }
        }

        if (builtAttribute.autoIncrement) {
          if (this.#autoIncrementAttributeName) {
            throw new Error(
              `Only one autoIncrement attribute is allowed per model, but both ${NodeUtil.inspect(attributeName)} and ${NodeUtil.inspect(this.#autoIncrementAttributeName)} are marked as autoIncrement.`,
            );
          }

          this.#autoIncrementAttributeName = attributeName;
        }

        Object.freeze(builtAttribute);

        this.#attributes.set(attributeName, builtAttribute);
        this.#columns.set(builtAttribute.columnName, builtAttribute);

        if (builtAttribute.type instanceof DataTypes.VIRTUAL) {
          this.#virtualAttributeNames.add(attributeName);
        } else {
          this.#physicalAttributes.set(attributeName, builtAttribute);
        }

        if (builtAttribute.get) {
          this.#attributesWithGetters.add(attributeName);
        }

        if (builtAttribute.set) {
          this.#attributesWithSetters.add(attributeName);
        }
      } catch (error) {
        throw new BaseError(
          `An error occurred while normalizing attribute ${JSON.stringify(attributeName)} in model ${JSON.stringify(this.modelName)}.`,
          { cause: error },
        );
      }
    }

    this.#refreshIndexes(attributeIndexes);

    this.hooks.runSync('afterDefinitionRefresh');
  }

  #refreshIndexes(attributeIndexes: IndexOptions[]): void {
    this.#indexes = [];

    for (const index of this.options.indexes) {
      this.#addIndex(index);
    }

    for (const index of attributeIndexes) {
      this.#addIndex(index);
    }
  }

  #addIndex(index: IndexOptions): void {
    index = this.#nameIndex(conformIndex(index));

    if (typeof index.fields?.[0] === 'string') {
      const column = this.columns.get(index.fields[0])?.attributeName;

      if (column) {
        // @ts-expect-error -- TODO: remove this 'column'. It does not work with composite indexes, and is only used by db2. On top of that, it's named "column" but is actually an attribute name.
        index.column = column;
      }
    }

    const existingIndex = this.#indexes.find(i => i.name === index.name);
    if (existingIndex == null) {
      this.#indexes.push(index);

      return;
    }

    for (const key of Object.keys(index) as Array<keyof IndexOptions>) {
      if (index[key] === undefined) {
        continue;
      }

      // @ts-expect-error -- TODO: remove this 'column'. It does not work with composite indexes, and is only used by db2 which should use fields instead.
      if (key === 'column') {
        continue;
      }

      // TODO: rename "fields" to columnNames
      if (key === 'fields') {
        if (existingIndex.fields == null) {
          existingIndex.fields = index.fields!;
        } else {
          existingIndex.fields = [...existingIndex.fields, ...index.fields!];
        }

        continue;
      }

      if (existingIndex[key] === undefined) {
        // @ts-expect-error -- same type
        existingIndex[key] = index[key];
      }

      if (existingIndex[key] !== index[key]) {
        throw new Error(
          `Index "${index.name}" has conflicting options: "${key}" was defined with different values ${NodeUtil.inspect(existingIndex[key])} and ${NodeUtil.inspect(index[key])}.`,
        );
      }
    }
  }

  #nameIndex(newIndex: IndexOptions): IndexOptions {
    if (Object.hasOwn(newIndex, 'name')) {
      return newIndex;
    }

    const newName = generateIndexName(this.table, newIndex);

    // TODO: check for collisions on *all* models, not just this one, as index names are global.
    for (const index of this.getIndexes()) {
      if (index.name === newName) {
        throw new Error(`Sequelize tried to give the name "${newName}" to index:
${NodeUtil.inspect(newIndex)}
on model "${this.modelName}", but that name is already taken by index:
${NodeUtil.inspect(index)}

Specify a different name for either index to resolve this issue.`);
      }
    }

    newIndex.name = newName;

    return newIndex;
  }

  getIndexes(): readonly IndexOptions[] {
    return this.#indexes;
  }

  /**
   * Returns the column name corresponding to the given attribute name.
   *
   * @param attributeName
   */
  getColumnName(attributeName: string): string {
    const attribute = this.#attributes.get(attributeName);

    if (attribute == null) {
      throw new Error(`Attribute "${attributeName}" does not exist on model "${this.modelName}".`);
    }

    return attribute.columnName;
  }

  /**
   * Returns the column name corresponding to the given attribute name if it exists, otherwise returns the attribute name.
   *
   * ⚠️ Using this method is highly discouraged. Users should specify column names & attribute names separately, to prevent any ambiguity.
   *
   * @param attributeName
   */
  getColumnNameLoose(attributeName: string): string {
    const attribute = this.#attributes.get(attributeName);

    return attribute?.columnName ?? attributeName;
  }

  /**
   * Follows the association path and returns the association at the end of the path.
   * For instance, say we have a model User, associated to a model Profile, associated to a model Address.
   *
   * If we call `User.modelDefinition.getAssociation(['profile', 'address'])`, we will get the association named `address` in the model Profile.
   * If we call `User.modelDefinition.getAssociation(['profile'])`, we will get the association named `profile` in the model User.
   *
   * @param associationPath
   */
  getAssociation(associationPath: readonly string[] | string): Association | undefined {
    if (typeof associationPath === 'string') {
      return this.associations[associationPath];
    }

    return this.#getAssociationFromPathMut([...associationPath]);
  }

  #getAssociationFromPathMut(associationPath: string[]): Association | undefined {
    if (associationPath.length === 0) {
      return undefined;
    }

    const associationName = associationPath.shift()!;
    const association = this.associations[associationName];

    if (association == null) {
      return undefined;
    }

    if (associationPath.length === 0) {
      return association;
    }

    return association.target.modelDefinition.#getAssociationFromPathMut(associationPath);
  }

  isParanoid(): boolean {
    return Boolean(this.timestampAttributeNames.deletedAt);
  }
}

const modelDefinitionListeners = new Set<(model: ModelStatic) => void>();
export function listenForModelDefinition(callback: (model: ModelStatic) => void): void {
  modelDefinitionListeners.add(callback);
}

const modelDefinitions = new WeakMap</* model class */ Function, ModelDefinition<any>>();

export function registerModelDefinition<M extends Model>(
  model: ModelStatic<M>,
  modelDefinition: ModelDefinition<M>,
): void {
  if (modelDefinitions.has(model)) {
    throw new Error(
      `Model ${model.name} has already been initialized. Models can only belong to one Sequelize instance. Registering the same model with multiple Sequelize instances is not yet supported. Please see https://github.com/sequelize/sequelize/issues/15389`,
    );
  }

  modelDefinitions.set(model, modelDefinition);

  for (const listener of modelDefinitionListeners) {
    listener(model);
  }
}

export function removeModelDefinition(model: ModelStatic): void {
  modelDefinitions.delete(model);
}

export function hasModelDefinition(model: ModelStatic): boolean {
  return modelDefinitions.has(model);
}

export function getModelDefinition(model: ModelStatic): ModelDefinition {
  const definition = modelDefinitions.get(model);
  if (!definition) {
    throw new Error(`Model ${model.name} has not been initialized yet.`);
  }

  return definition;
}

export function normalizeReference(
  references: AttributeOptions['references'],
): NormalizedAttributeReferencesOptions | undefined {
  if (!references) {
    return undefined;
  }

  if (typeof references === 'string') {
    return Object.freeze(
      banReferenceModel({
        table: references,
      }),
    );
  }

  if (isModelStatic(references)) {
    return Object.freeze(
      banReferenceModel({
        table: references.table,
      }),
    );
  }

  const { model, table, ...referencePassDown } = references;

  if (model && table) {
    throw new Error('"references" cannot contain both "model" and "tableName"');
  }

  // It's possible that the model has not been defined yet but the user configured other fields, in cases where
  // the reference is added by an association initializing itself.
  // If that happens, we won't add the reference until the association is initialized and this method gets called again.
  if (!model && !table) {
    return undefined;
  }

  if (model || table) {
    return Object.freeze(
      banReferenceModel({
        table: model ? model.table : table!,
        ...referencePassDown,
      }),
    );
  }
}

function banReferenceModel<T>(reference: T): T {
  Object.defineProperty(reference, 'model', {
    enumerable: false,
    get() {
      throw new Error(
        'references.model has been renamed to references.tableName in normalized references options.',
      );
    },
  });

  return reference;
}

/**
 * This method mutates the first parameter.
 *
 * @param existingModelOptions
 * @param options
 * @param overrideOnConflict
 */
export function mergeModelOptions<M extends Model>(
  existingModelOptions: ModelOptions<M>,
  options: ModelOptions<M>,
  overrideOnConflict: boolean,
): ModelOptions<M> {
  // merge-able: scopes, indexes
  for (const [optionName, optionValue] of Object.entries(options) as Array<
    [keyof ModelOptions, any]
  >) {
    if (existingModelOptions[optionName] === undefined) {
      existingModelOptions[optionName] = optionValue;
      continue;
    }

    // These are objects. We merge their properties, unless the same key is used in both values.
    if (optionName === 'scopes' || optionName === 'validate') {
      for (const [subOptionName, subOptionValue] of getAllOwnEntries(optionValue)) {
        // @ts-expect-error -- dynamic type, not worth typing
        if (existingModelOptions[optionName][subOptionName] === subOptionValue) {
          continue;
        }

        if (!overrideOnConflict && subOptionName in existingModelOptions[optionName]) {
          throw new Error(
            `Trying to set the option ${optionName}[${JSON.stringify(subOptionName)}], but a value already exists.`,
          );
        }

        // @ts-expect-error -- runtime type checking is enforced by model
        existingModelOptions[optionName][subOptionName] = subOptionValue;
      }

      continue;
    }

    if (optionName === 'hooks') {
      const existingHooks = existingModelOptions.hooks!;
      for (const hookType of Object.keys(optionValue) as Array<keyof ModelHooks>) {
        if (!existingHooks[hookType]) {
          // @ts-expect-error -- type is too complex for typescript
          existingHooks[hookType] = optionValue[hookType];
          continue;
        }

        const existingHooksOfType = Array.isArray(existingHooks[hookType])
          ? existingHooks[hookType]
          : [existingHooks[hookType]];

        if (!Array.isArray(optionValue[hookType])) {
          // eslint-disable-next-line @typescript-eslint/prefer-ts-expect-error -- became valid in TS 5.8
          // @ts-ignore -- typescript doesn't like this merge algorithm.
          existingHooks[hookType] = [...existingHooksOfType, optionValue[hookType]];
        } else {
          // eslint-disable-next-line @typescript-eslint/prefer-ts-expect-error -- This error only occurs on TS 5.3+
          // @ts-ignore -- typescript doesn't like this merge algorithm.
          existingHooks[hookType] = [...existingHooksOfType, ...optionValue[hookType]];
        }
      }

      continue;
    }

    // This is an array. Simple array merge.
    if (optionName === 'indexes') {
      existingModelOptions.indexes = [...existingModelOptions.indexes!, ...optionValue];

      continue;
    }

    if (!overrideOnConflict && optionValue !== existingModelOptions[optionName]) {
      throw new Error(`Trying to set the option ${optionName}, but a value already exists.`);
    }

    existingModelOptions[optionName] = optionValue;
  }

  return existingModelOptions;
}
