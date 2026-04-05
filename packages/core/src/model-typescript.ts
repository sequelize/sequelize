import type { PartialBy } from '@sequelize/utils';
import { isPlainObject } from '@sequelize/utils';
import { inspect } from 'node:util';
import type {
  AbstractQueryGenerator,
  AbstractQueryInterface,
  Association,
  AttributeOptions,
  Attributes,
  BrandedKeysOf,
  BuiltModelOptions,
  FindByPkOptions,
  ForeignKeyBrand,
  IndexOptions,
  InitOptions,
  ModelAttributes,
  ModelStatic,
  NonNullFindByPkOptions,
  NormalizedAttributeOptions,
  Sequelize,
  TableNameWithSchema,
} from '.';
import { isDecoratedModel } from './decorators/shared/model.js';
import {
  legacyBuildAddAnyHook,
  legacyBuildAddHook,
  legacyBuildHasHook,
  legacyBuildRemoveHook,
  legacyBuildRunHook,
} from './hooks-legacy.js';
import {
  ModelDefinition,
  getModelDefinition,
  hasModelDefinition,
  registerModelDefinition,
} from './model-definition.js';
import { staticModelHooks } from './model-hooks.js';
import type { ModelRepository } from './model-repository.js';
import { getModelRepository } from './model-repository.js';
import type { DestroyOptions } from './model.js';
import { Model } from './model.js';
import { and } from './sequelize.js';
import { noModelTableName } from './utils/deprecations.js';
import { getObjectFromMap } from './utils/object.js';

// DO NOT MAKE THIS CLASS PUBLIC!
/**
 * This is a temporary class used to progressively migrate the Model class to TypeScript by slowly moving its functions here.
 * Always use {@link Model} instead.
 */
export class ModelTypeScript {
  static get queryInterface(): AbstractQueryInterface {
    return this.sequelize.queryInterface;
  }

  static get queryGenerator(): AbstractQueryGenerator {
    return this.sequelize.queryGenerator;
  }

  /**
   * A reference to the sequelize instance.
   */
  get sequelize(): Sequelize {
    return (this.constructor as typeof ModelTypeScript).sequelize;
  }

  /**
   * A reference to the sequelize instance.
   *
   * Accessing this property throws if the model has not been registered with a Sequelize instance yet.
   */
  static get sequelize(): Sequelize {
    return this.modelDefinition.sequelize;
  }

  /**
   * Returns the model definition of this model.
   * The model definition contains all metadata about this model.
   */
  static get modelDefinition(): ModelDefinition {
    // @ts-expect-error -- getModelDefinition expects ModelStatic
    return getModelDefinition(this);
  }

  get modelDefinition(): ModelDefinition {
    return (this.constructor as ModelStatic).modelDefinition;
  }

  static get modelRepository(): ModelRepository {
    return getModelRepository(this.modelDefinition);
  }

  get modelRepository(): ModelRepository {
    return (this.constructor as ModelStatic).modelRepository;
  }

  /**
   * An object hash from alias to the association object
   */
  static get associations(): { [associationName: string]: Association } {
    return this.modelDefinition.associations;
  }

  /**
   * The name of the primary key attribute (on the JS side).
   *
   * @deprecated This property doesn't work for composed primary keys. Use {@link primaryKeyAttributes} instead.
   */
  static get primaryKeyAttribute(): string | null {
    return this.primaryKeyAttributes[0] ?? null;
  }

  /**
   * The name of the primary key attributes (on the JS side).
   *
   * @deprecated use {@link modelDefinition}.
   */
  static get primaryKeyAttributes(): string[] {
    return [...this.modelDefinition.primaryKeysAttributeNames];
  }

  /**
   * The column name of the primary key.
   *
   * @deprecated don't use this. It doesn't work with composite PKs. It may be removed in the future to reduce duplication.
   *  Use the. Use {@link Model.primaryKeys} instead.
   */
  static get primaryKeyField(): string | null {
    const primaryKeyAttribute = this.primaryKeyAttribute;
    if (!primaryKeyAttribute) {
      return null;
    }

    return this.modelDefinition.getColumnName(primaryKeyAttribute);
  }

  /**
   * Like {@link Model.rawAttributes}, but only includes attributes that are part of the Primary Key.
   */
  static get primaryKeys(): { [attribute: string]: NormalizedAttributeOptions } {
    const out = Object.create(null);

    const definition = this.modelDefinition;

    for (const primaryKey of definition.primaryKeysAttributeNames) {
      out[primaryKey] = definition.attributes.get(primaryKey)!;
    }

    return out;
  }

  /**
   * The options that the model was initialized with
   */
  static get options(): BuiltModelOptions {
    return this.modelDefinition.options;
  }

  /**
   * The name of the database table
   *
   * @deprecated use {@link modelDefinition} or {@link table}.
   */
  static get tableName(): string {
    noModelTableName();

    return this.modelDefinition.table.tableName;
  }

  static get table(): TableNameWithSchema {
    return this.modelDefinition.table;
  }

  /**
   * @deprecated use {@link modelDefinition}'s {@link ModelDefinition#rawAttributes} or {@link ModelDefinition#attributes} instead.
   */
  static get rawAttributes(): { [attribute: string]: AttributeOptions } {
    throw new Error(`${this.name}.rawAttributes has been removed, as it has been split in two:
- If you only need to read the final attributes, use ${this.name}.modelDefinition.attributes
- If you need to modify the attributes, mutate ${this.name}.modelDefinition.rawAttributes, then call ${this.name}.modelDefinition.refreshAttributes()`);
  }

  /**
   * @deprecated use {@link modelDefinition}'s {@link ModelDefinition#rawAttributes} or {@link ModelDefinition#attributes} instead.
   */
  get rawAttributes(): { [attribute: string]: AttributeOptions } {
    return (this.constructor as typeof ModelTypeScript).rawAttributes;
  }

  /**
   * @deprecated use {@link modelDefinition}'s {@link ModelDefinition#columns}.
   */
  static get fieldRawAttributesMap(): { [columnName: string]: NormalizedAttributeOptions } {
    return getObjectFromMap(this.modelDefinition.columns);
  }

  /**
   * @deprecated use {@link modelDefinition}'s {@link ModelDefinition#physicalAttributes}.
   */
  static get tableAttributes(): { [attribute: string]: NormalizedAttributeOptions } {
    return getObjectFromMap(this.modelDefinition.physicalAttributes);
  }

  /**
   * A mapping of column name to attribute name
   *
   * @private
   */
  static get fieldAttributeMap(): { [columnName: string]: string } {
    const out = Object.create(null);

    const attributes = this.modelDefinition.attributes;
    for (const attribute of attributes.values()) {
      out[attribute.columnName] = attribute.attributeName;
    }

    return out;
  }

  static get hooks() {
    return this.modelDefinition.hooks;
  }

  static addHook = legacyBuildAddAnyHook(staticModelHooks);
  static hasHook = legacyBuildHasHook(staticModelHooks);
  static hasHooks = legacyBuildHasHook(staticModelHooks);
  static removeHook = legacyBuildRemoveHook(staticModelHooks);
  static runHooks = legacyBuildRunHook(staticModelHooks);

  static beforeValidate = legacyBuildAddHook(staticModelHooks, 'beforeValidate');
  static afterValidate = legacyBuildAddHook(staticModelHooks, 'afterValidate');
  static validationFailed = legacyBuildAddHook(staticModelHooks, 'validationFailed');

  static beforeCreate = legacyBuildAddHook(staticModelHooks, 'beforeCreate');
  static afterCreate = legacyBuildAddHook(staticModelHooks, 'afterCreate');

  static beforeDestroy = legacyBuildAddHook(staticModelHooks, 'beforeDestroy');
  static afterDestroy = legacyBuildAddHook(staticModelHooks, 'afterDestroy');

  static beforeRestore = legacyBuildAddHook(staticModelHooks, 'beforeRestore');
  static afterRestore = legacyBuildAddHook(staticModelHooks, 'afterRestore');

  static beforeUpdate = legacyBuildAddHook(staticModelHooks, 'beforeUpdate');
  static afterUpdate = legacyBuildAddHook(staticModelHooks, 'afterUpdate');

  static beforeUpsert = legacyBuildAddHook(staticModelHooks, 'beforeUpsert');
  static afterUpsert = legacyBuildAddHook(staticModelHooks, 'afterUpsert');

  static beforeSave = legacyBuildAddHook(staticModelHooks, 'beforeSave');
  static afterSave = legacyBuildAddHook(staticModelHooks, 'afterSave');

  static beforeBulkCreate = legacyBuildAddHook(staticModelHooks, 'beforeBulkCreate');
  static afterBulkCreate = legacyBuildAddHook(staticModelHooks, 'afterBulkCreate');

  static beforeBulkDestroy = legacyBuildAddHook(staticModelHooks, 'beforeBulkDestroy');
  static afterBulkDestroy = legacyBuildAddHook(staticModelHooks, 'afterBulkDestroy');

  static beforeBulkRestore = legacyBuildAddHook(staticModelHooks, 'beforeBulkRestore');
  static afterBulkRestore = legacyBuildAddHook(staticModelHooks, 'afterBulkRestore');

  static beforeBulkUpdate = legacyBuildAddHook(staticModelHooks, 'beforeBulkUpdate');
  static afterBulkUpdate = legacyBuildAddHook(staticModelHooks, 'afterBulkUpdate');

  static beforeCount = legacyBuildAddHook(staticModelHooks, 'beforeCount');

  static beforeFind = legacyBuildAddHook(staticModelHooks, 'beforeFind');
  static beforeFindAfterExpandIncludeAll = legacyBuildAddHook(
    staticModelHooks,
    'beforeFindAfterExpandIncludeAll',
  );

  static beforeFindAfterOptions = legacyBuildAddHook(staticModelHooks, 'beforeFindAfterOptions');
  static afterFind = legacyBuildAddHook(staticModelHooks, 'afterFind');

  static beforeSync = legacyBuildAddHook(staticModelHooks, 'beforeSync');
  static afterSync = legacyBuildAddHook(staticModelHooks, 'afterSync');

  static beforeAssociate = legacyBuildAddHook(staticModelHooks, 'beforeAssociate');
  static afterAssociate = legacyBuildAddHook(staticModelHooks, 'afterAssociate');

  /**
   * Initialize a model, representing a table in the DB, with attributes and options.
   *
   * The table columns are defined by the hash that is given as the first argument.
   * Each attribute of the hash represents a column.
   *
   * @example
   * ```javascript
   * Project.init({
   *   columnA: {
   *     type: DataTypes.BOOLEAN,
   *     validate: {
   *       is: ['[a-z]','i'],        // will only allow letters
   *       max: 23,                  // only allow values <= 23
   *       isIn: {
   *         args: [['en', 'zh']],
   *         msg: "Must be English or Chinese"
   *       }
   *     },
   *     field: 'column_a'
   *     // Other attributes here
   *   },
   *   columnB: DataTypes.STRING,
   *   columnC: 'MY VERY OWN COLUMN TYPE'
   * }, {sequelize})
   * ```
   *
   * sequelize.models.modelName // The model will now be available in models under the class name
   *
   * @see https://sequelize.org/docs/v7/core-concepts/model-basics/
   * @see https://sequelize.org/docs/v7/core-concepts/validations-and-constraints/
   *
   * @param attributes An object, where each attribute is a column of the table. Each column can be either a
   *   DataType, a string or a type-description object.
   * @param options These options are merged with the default define options provided to the Sequelize constructor
   */
  static init<M extends Model, MS extends ModelStatic<M>>(
    this: MS,
    attributes: ModelAttributes<
      M,
      // 'foreign keys' are optional in Model.init as they are added by association declaration methods
      PartialBy<Attributes<M>, BrandedKeysOf<Attributes<M>, typeof ForeignKeyBrand>>
    >,
    options: InitOptions<M>,
  ): MS {
    if (isDecoratedModel(this)) {
      throw new Error(
        `Model.init cannot be used if the model uses one of Sequelize's decorators. You must pass your model to the Sequelize constructor using the "models" option instead.`,
      );
    }

    if (!options.sequelize) {
      throw new Error(
        'Model.init expects a Sequelize instance to be passed through the option bag, which is the second parameter.',
      );
    }

    initModel(this, attributes, options);

    return this;
  }

  static getIndexes(): readonly IndexOptions[] {
    return this.modelDefinition.getIndexes();
  }

  /**
   * Unique indexes that can be declared as part of a CREATE TABLE query.
   *
   * @deprecated prefer using {@link getIndexes}, this will eventually be removed.
   */
  static get uniqueKeys() {
    const indexes = this.getIndexes();
    const uniqueKeys = Object.create(null);

    // TODO: "column" should be removed from index definitions
    const supportedOptions = ['unique', 'fields', 'column', 'name'];

    for (const index of indexes) {
      if (!index.unique) {
        continue;
      }

      if (!index.name) {
        continue;
      }

      if (!index.fields) {
        continue;
      }

      if (!index.fields.every(field => typeof field === 'string')) {
        continue;
      }

      if (!Object.keys(index).every(optionName => supportedOptions.includes(optionName))) {
        continue;
      }

      uniqueKeys[index.name] = index;
    }

    return uniqueKeys;
  }

  // TODO [>7]: Remove this
  private static get _indexes(): never {
    throw new Error('Model._indexes has been replaced with Model.getIndexes()');
  }

  /**
   * Refreshes the Model's attribute definition.
   *
   * @deprecated use {@link modelDefinition}.
   */
  static refreshAttributes(): void {
    this.modelDefinition.refreshAttributes();
  }

  static assertIsInitialized(): void {
    if (!this.isInitialized()) {
      throw new Error(
        `Model "${this.name}" has not been initialized yet. You can check whether a model has been initialized by calling its isInitialized method.`,
      );
    }
  }

  static isInitialized(): boolean {
    // @ts-expect-error -- getModelDefinition expects ModelStatic
    return hasModelDefinition(this);
  }

  /**
   * Get the table name of the model, taking schema into account. The method will an object with `tableName`, `schema` and `delimiter` properties.
   *
   * @deprecated use {@link modelDefinition} or {@link table}.
   */
  static getTableName(): TableNameWithSchema {
    noModelTableName();

    const queryGenerator = this.sequelize.queryGenerator;

    return {
      ...this.table,
      /**
       * @deprecated This should not be relied upon!
       */
      // @ts-expect-error -- This toString is a hacky property that must be removed
      toString() {
        return queryGenerator.quoteTable(this);
      },
    };
  }

  /**
   * Works like the {@link Model#destroy} instance method, but is capable of deleting multiple instances in one query.
   * Unlike {@link Model.destroy}, this method takes instances, not a `where` option.
   *
   * @param instances The instances to delete.
   * @param options Options.
   */
  static async _UNSTABLE_destroyMany<M extends Model>(
    this: ModelStatic<M>,
    instances: M | M[],
    options?: DestroyOptions<Attributes<M>>,
  ): Promise<number> {
    return this.modelRepository._UNSTABLE_destroy(instances, options);
  }

  /**
   * Search for a single instance by its primary key.
   *
   * This applies LIMIT 1, only a single instance will be returned.
   *
   * Returns the model with the matching primary key.
   * If not found, returns null or throws an error if {@link FindOptions.rejectOnEmpty} is set.
   */
  static findByPk<M extends Model, R = Attributes<M>>(
    this: ModelStatic<M>,
    identifier: unknown,
    options: FindByPkOptions<M> & { raw: true; rejectOnEmpty?: false },
  ): Promise<R | null>;
  static findByPk<M extends Model, R = Attributes<M>>(
    this: ModelStatic<M>,
    identifier: unknown,
    options: NonNullFindByPkOptions<M> & { raw: true },
  ): Promise<R>;
  static findByPk<M extends Model>(
    this: ModelStatic<M>,
    identifier: unknown,
    options: NonNullFindByPkOptions<M>,
  ): Promise<M>;
  static findByPk<M extends Model>(
    this: ModelStatic<M>,
    identifier: unknown,
    options?: FindByPkOptions<M>,
  ): Promise<M | null>;

  /**
   * Search for a single instance by its primary key.
   *
   * This applies LIMIT 1, only a single instance will be returned.
   *
   * Returns the model with the matching primary key.
   * If not found, returns null or throws an error if {@link FindOptions.rejectOnEmpty} is set.
   *
   * If the model has a composite primary key, pass an object with the primary key attributes.
   *
   * @param identifier The value of the desired instance's primary key.
   * @param options find options
   */
  static async findByPk<M extends Model>(
    this: ModelStatic<M>,
    identifier: unknown,
    options?: FindByPkOptions<Attributes<M>>,
  ): Promise<Model | null> {
    if (identifier == null) {
      throw new Error(`${identifier} is not a valid primary key`);
    }

    const primaryKeyAttributeNames = this.modelDefinition.primaryKeysAttributeNames;
    if (primaryKeyAttributeNames.size === 0) {
      throw new Error(
        `Model ${this.name} does not have a primary key attribute, so findByPk cannot be used`,
      );
    }

    const pkWhere = Object.create(null);
    if (primaryKeyAttributeNames.size === 1) {
      pkWhere[primaryKeyAttributeNames.firstValue()!] = identifier;
    } else {
      if (!isPlainObject(identifier)) {
        throw new TypeError(
          `Model ${this.name} has a composite primary key. Please pass all primary keys in an object like { pk1: value1, pk2: value2 }. Received: ${inspect(identifier)}`,
        );
      }

      for (const attributeName of primaryKeyAttributeNames) {
        if (identifier[attributeName] === undefined) {
          throw new TypeError(
            `Part of the composite primary key, ${attributeName}, is missing. Please pass all primary key attributes. Received: ${inspect(identifier)}`,
          );
        }

        pkWhere[attributeName] = identifier[attributeName];
      }
    }

    // Bypass a possible overloaded findOne
    return Model.findOne.call(this, {
      ...options,
      where: options?.where ? and(options?.where, pkWhere) : pkWhere,
    });
  }
}

export function initModel<M extends Model>(
  model: ModelStatic<M>,
  attributes: ModelAttributes<M>,
  options: InitOptions<M>,
): void {
  options.modelName ||= model.name;

  const modelDefinition = new ModelDefinition(attributes, options, model);

  Object.defineProperty(model, 'name', { value: modelDefinition.modelName });

  registerModelDefinition(model, modelDefinition);

  // @ts-expect-error -- TODO: type
  model._scope = model.options.defaultScope;
  // @ts-expect-error -- TODO: type
  model._scopeNames = ['defaultScope'];

  model.sequelize.hooks.runSync('afterDefine', model);

  addAttributeGetterAndSetters(model);
  model.hooks.addListener('afterDefinitionRefresh', () => {
    addAttributeGetterAndSetters(model);
  });
}

function addAttributeGetterAndSetters(model: ModelStatic) {
  const modelDefinition = model.modelDefinition;

  // TODO: temporary workaround due to cyclic import. Should not be necessary once Model is fully migrated to TypeScript.
  const { Model: TmpModel } = require('./model.js');

  // add attributes to the DAO prototype
  for (const attribute of modelDefinition.attributes.values()) {
    const attributeName = attribute.attributeName;

    if (attributeName in TmpModel.prototype) {
      model.sequelize.log(
        `Attribute ${attributeName} in model ${model.name} is shadowing a built-in property of the Model prototype. This is not recommended. Consider renaming your attribute.`,
      );

      continue;
    }

    const attributeProperty: PropertyDescriptor = {
      configurable: true,
      get(this: Model) {
        return this.get(attributeName);
      },
      set(this: Model, value: unknown) {
        return this.set(attributeName, value);
      },
    };

    Object.defineProperty(model.prototype, attributeName, attributeProperty);
  }
}
