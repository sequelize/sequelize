import assert from 'assert';
import isObject from 'lodash/isObject.js';
import upperFirst from 'lodash/upperFirst';
import { AssociationError } from '../errors/index.js';
import type {
  ModelStatic,
  Model,
  CreateOptions,
  CreationAttributes,
  FindOptions,
  SaveOptions,
  AttributeNames,
  Attributes,
  BuiltModelAttributeColumOptions,
} from '../model';
import { Op } from '../operators';
import * as Utils from '../utils';
import { removeUndefined } from '../utils';
import { isSameInitialModel } from '../utils/model-utils.js';
import type { AssociationOptions, SingleAssociationAccessors } from './base';
import { Association } from './base';
import { HasMany } from './has-many.js';
import { HasOne } from './has-one.js';
import type { NormalizeBaseAssociationOptions } from './helpers';
import {
  defineAssociation,
  mixinMethods, normalizeBaseAssociationOptions,
} from './helpers';

/**
 * One-to-one association
 * See {@link Model.belongsTo}
 *
 * This is almost the same as {@link HasOne}, but the foreign key will be defined on the source model.
 *
 * In the API reference below, add the name of the association to the method, e.g. for `User.belongsTo(Project)` the getter will be `user.getProject()`.
 *
 * @typeParam S The model on which {@link Model.belongsTo} has been called, on which the association methods, as well as the foreign key attribute, will be added.
 * @typeParam T The model passed to {@link Model.belongsTo}.
 * @typeParam SourceKey The name of the Foreign Key attribute on the Source model.
 * @typeParam TargetKey The name of the attribute that the foreign key in the source model will reference, typically the Primary Key.
 */
export class BelongsTo<
  S extends Model = Model,
  T extends Model = Model,
  SourceKey extends AttributeNames<S> = any,
  TargetKey extends AttributeNames<T> = any,
> extends Association<S, T, SourceKey, NormalizedBelongsToOptions<SourceKey, TargetKey>> {

  readonly accessors: SingleAssociationAccessors;

  /**
   * The attribute name of the identifier
   *
   * @deprecated use {@link foreignKey} instead
   */
  get identifier(): string {
    return this.foreignKey;
  }

  foreignKey: SourceKey;

  /**
   * The column name of the foreign key
   */
  identifierField: string;

  /**
   * The name of the attribute the foreign key points to.
   * In belongsTo, this key is on the Target Model, instead of the Source Model  (unlike {@link HasOne.sourceKey}).
   * The {@link Association.foreignKey} is on the Source Model.
   */
  targetKey: TargetKey;

  /**
   * The column name of the target key
   */
  readonly targetKeyField: string;

  readonly targetKeyIsPrimary: boolean;

  /**
   * @deprecated use {@link BelongsTo.targetKey}
   */
  get targetIdentifier(): string {
    return this.targetKey;
  }

  inverse: Association | undefined;

  constructor(
    secret: symbol,
    source: ModelStatic<S>,
    target: ModelStatic<T>,
    options: NormalizedBelongsToOptions<SourceKey, TargetKey>,
    parent?: Association,
  ) {
    // TODO: throw is source model has a composite primary key.
    const targetKey = options?.targetKey || (target.primaryKeyAttribute as TargetKey);

    if (!target.getAttributes()[targetKey]) {
      throw new Error(`Unknown attribute "${options.targetKey}" passed as targetKey, define this attribute on model "${target.name}" first`);
    }

    if ('keyType' in options) {
      throw new TypeError('Option "keyType" has been removed from the BelongsTo\'s options. Set "foreignKey.type" instead.');
    }

    super(secret, source, target, options, parent);

    this.targetKey = targetKey;

    // For Db2 server, a reference column of a FOREIGN KEY must be unique
    // else, server throws SQL0573N error. Hence, setting it here explicitly
    // for non primary columns.
    if (target.sequelize!.options.dialect === 'db2' && this.target.getAttributes()[this.targetKey].primaryKey !== true) {
      // TODO: throw instead
      this.target.getAttributes()[this.targetKey].unique = true;
    }

    let foreignKey: string | undefined;
    let foreignKeyAttributeOptions;
    if (isObject(this.options?.foreignKey)) {
      // lodash has poor typings
      assert(typeof this.options?.foreignKey === 'object');

      foreignKeyAttributeOptions = this.options.foreignKey;
      foreignKey = this.options.foreignKey.name || this.options.foreignKey.fieldName;
    } else if (this.options?.foreignKey) {
      foreignKey = this.options.foreignKey;
    }

    if (!foreignKey) {
      foreignKey = this.inferForeignKey();
    }

    this.foreignKey = foreignKey as SourceKey;
    const existingForeignKeyAttribute: BuiltModelAttributeColumOptions | undefined
      = this.source.rawAttributes[this.foreignKey];

    this.targetKeyField = Utils.getColumnName(this.target.getAttributes()[this.targetKey]);
    this.targetKeyIsPrimary = this.targetKey === this.target.primaryKeyAttribute;

    const fkAllowsNull = foreignKeyAttributeOptions?.allowNull ?? existingForeignKeyAttribute?.allowNull ?? true;

    // Foreign Key options are selected like this:
    // 1. if provided explicitly through options.foreignKey, use that
    // 2. if the foreign key is already defined on the source model, use that
    // 3. hardcoded default value
    // Note: If options.foreignKey is provided, but the foreign key also exists on the source model,
    //  mergeAttributesDefault will throw an error if the two options are incompatible.
    const newForeignKeyAttribute = removeUndefined({
      type: existingForeignKeyAttribute?.type ?? this.target.rawAttributes[this.targetKey].type,
      ...foreignKeyAttributeOptions,
      allowNull: fkAllowsNull,
      onDelete: foreignKeyAttributeOptions?.onDelete ?? existingForeignKeyAttribute?.onDelete ?? (fkAllowsNull ? 'SET NULL' : 'CASCADE'),
      onUpdate: foreignKeyAttributeOptions?.onUpdate ?? existingForeignKeyAttribute?.onUpdate ?? 'CASCADE',
    });

    if (options.foreignKeyConstraints !== false) {
      newForeignKeyAttribute.references = {
        model: this.target.getTableName(),
        key: this.targetKeyField,
      };
    }

    this.source.mergeAttributesDefault({
      [this.foreignKey]: newForeignKeyAttribute,
    });

    this.identifierField = Utils.getColumnName(this.source.getAttributes()[this.foreignKey]);

    // Get singular name, trying to uppercase the first letter, unless the model forbids it
    const singular = upperFirst(this.options.name.singular);

    this.accessors = {
      get: `get${singular}`,
      set: `set${singular}`,
      create: `create${singular}`,
    };

    this.#mixin(source.prototype);

    if (options.inverse) {
      const passDown = removeUndefined({
        ...options,
        as: options.inverse.as,
        scope: options.inverse?.scope,
        sourceKey: options.targetKey,
        inverse: undefined,
      });

      delete passDown.targetKey;

      switch (options.inverse.type) {
        case 'hasMany':
          HasMany.associate(secret, target, source, passDown, this);
          break;

        case 'hasOne':
          HasOne.associate(secret, target, source, passDown, this);
          break;

        default:
          throw new Error(`Invalid option received for "inverse.type": ${options.inverse.type} is not recognised. Expected "hasMany" or "hasOne"`);
      }
    }
  }

  static associate<
    S extends Model,
    T extends Model,
    SourceKey extends AttributeNames<S>,
    TargetKey extends AttributeNames<T>,
    >(
    secret: symbol,
    source: ModelStatic<S>,
    target: ModelStatic<T>,
    options: BelongsToOptions<SourceKey, TargetKey> = {},
    parent?: Association<any>,
  ): BelongsTo<S, T, SourceKey, TargetKey> {
    return defineAssociation<
      BelongsTo<S, T, SourceKey, TargetKey>,
      BelongsToOptions<SourceKey, TargetKey>,
      NormalizedBelongsToOptions<SourceKey, TargetKey>
    >(BelongsTo, source, target, options, parent, normalizeBaseAssociationOptions, normalizedOptions => {
      // self-associations must always set their 'as' parameter
      if (isSameInitialModel(source, target) && options.inverse
        // use 'options' because this will always be set in 'newOptions'
        && (!options.as || !options.inverse.as || options.as === options.inverse.as)) {
        throw new AssociationError(`Both options "as" and "inverse.as" must be defined for belongsTo self-associations, and their value must be different, if you specify the 'inverse' option.`);
      }

      return new BelongsTo(secret, source, target, normalizedOptions, parent);
    });
  }

  #mixin(modelPrototype: Model): void {
    mixinMethods(this, modelPrototype, ['get', 'set', 'create']);
  }

  protected inferForeignKey(): string {
    const associationName = Utils.singularize(this.options.as);
    if (!associationName) {
      throw new Error('Sanity check: Could not guess the name of the association');
    }

    return Utils.camelize(`${associationName}_${this.targetKey}`);
  }

  /**
   * Get the associated instance.
   *
   * See {@link BelongsToGetAssociationMixinOptions} for a full explanation of options.
   * This method is mixed-in the source model prototype. See {@link BelongsToGetAssociationMixin}.
   *
   * @param instances source instances
   * @param options find options
   */
  async get(instances: S, options: BelongsToGetAssociationMixinOptions<T>): Promise<T | null>;
  async get(instances: S[], options: BelongsToGetAssociationMixinOptions<T>): Promise<Map<any, T | null>>;
  async get(
    instances: S | S[],
    options: BelongsToGetAssociationMixinOptions<T>,
  ): Promise<Map<any, T | null> | T | null> {
    options = Utils.cloneDeep(options);

    let Target = this.target;
    if (options.scope != null) {
      if (!options.scope) {
        Target = Target.unscoped();
      } else if (options.scope !== true) { // 'true' means default scope. Which is the same as not doing anything.
        Target = Target.scope(options.scope);
      }
    }

    if (options.schema != null) {
      Target = Target.schema(options.schema, options.schemaDelimiter);
    }

    let isManyMode = true;
    if (!Array.isArray(instances)) {
      isManyMode = false;
      instances = [instances];
    }

    // TODO: the scope is ignored
    const where = Object.create(null);

    if (instances.length > 1) {
      where[this.targetKey] = {
        [Op.in]: instances.map(_instance => _instance.get(this.foreignKey)),
      };
    } else {
      const foreignKeyValue = instances[0].get(this.foreignKey);

      if (this.targetKeyIsPrimary && !options.where) {
        return Target.findByPk(
          foreignKeyValue as any,
          options,
        );
      }

      where[this.targetKey] = foreignKeyValue;
      options.limit = null;
    }

    options.where = options.where
      ? { [Op.and]: [where, options.where] }
      : where;

    if (isManyMode) {
      const results = await Target.findAll(options);
      const result: Map<any, T | null> = new Map();

      for (const instance of results) {
        result.set(instance.get(this.targetKey, { raw: true }), instance);
      }

      return result;
    }

    return Target.findOne(options);
  }

  /**
   * Set the associated model.
   *
   * @param sourceInstance the source instance
   * @param associatedInstance An persisted instance or the primary key of an instance to associate with this. Pass `null` to remove the association.
   * @param options options passed to `this.save`
   */
  async set(
    sourceInstance: S,
    associatedInstance: T | T[TargetKey] | null,
    options: BelongsToSetAssociationMixinOptions<T> = {},
  ): Promise<void> {
    let value = associatedInstance;

    if (associatedInstance != null && associatedInstance instanceof this.target) {
      value = (associatedInstance as T)[this.targetKey];
    }

    sourceInstance.set(this.foreignKey, value);

    if (options.save === false) {
      return;
    }

    // passes the changed field to save, so only that field get updated.
    await sourceInstance.save({
      fields: [this.foreignKey],
      association: true,
      ...options,
    });
  }

  /**
   * Create a new instance of the associated model and associate it with this.
   *
   * @param sourceInstance the source instance
   * @param values values to create associated model instance with
   * @param options Options passed to `target.create` and setAssociation.
   *
   * @returns The created target model
   */
  async create(
    sourceInstance: S,
    // @ts-expect-error -- {} is not always assignable to 'values', but Target.create will enforce this, not us.
    values: CreationAttributes<T> = {},
    options: BelongsToCreateAssociationMixinOptions<T> = {},
  ): Promise<T> {
    values = values || {};
    options = options || {};

    const newAssociatedObject = await this.target.create(values, options);
    await this.set(sourceInstance, newAssociatedObject, options);

    return newAssociatedObject;
  }
}

// workaround https://github.com/evanw/esbuild/issues/1260
Object.defineProperty(BelongsTo, 'name', {
  value: 'BelongsTo',
});

export type NormalizedBelongsToOptions<SourceKey extends string, TargetKey extends string> =
  NormalizeBaseAssociationOptions<BelongsToOptions<SourceKey, TargetKey>>;

/**
 * Options provided when associating models with belongsTo relationship
 *
 * @see Association class belongsTo method
 */
export interface BelongsToOptions<SourceKey extends string, TargetKey extends string> extends AssociationOptions<SourceKey> {
  /**
   * The name of the field to use as the key for the association in the target table. Defaults to the primary
   * key of the target table
   */
  targetKey?: TargetKey;

  inverse?: {
    type: 'hasMany' | 'hasOne',
    as?: string,
    scope?: AssociationOptions<any>['scope'],
  };
}

/**
 * The options for the getAssociation mixin of the belongsTo association.
 *
 * @see BelongsToGetAssociationMixin
 */
export interface BelongsToGetAssociationMixinOptions<T extends Model> extends FindOptions<Attributes<T>> {
  /**
   * Apply a scope on the related model, or remove its default scope by passing false.
   */
  scope?: string | string[] | boolean;

  /**
   * Apply a schema on the related model
   */
  schema?: string;
  schemaDelimiter?: string;
}

/**
 * The getAssociation mixin applied to models with belongsTo.
 * An example of usage is as follows:
 *
 * ```typescript
 * class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
 *  declare getRole: BelongsToGetAssociationMixin<Role>;
 * }
 *
 * User.belongsTo(Role);
 * ```
 *
 * @see Model.belongsTo
 */
// TODO: in the future, type the return value based on whether the foreign key is nullable or not on the source model.
//   if nullable, return TModel | null
//   https://github.com/sequelize/meetings/issues/14
export type BelongsToGetAssociationMixin<T extends Model> =
  (options?: BelongsToGetAssociationMixinOptions<T>) => Promise<T | null>;

/**
 * The options for the setAssociation mixin of the belongsTo association.
 *
 * @see BelongsToSetAssociationMixin
 */
export interface BelongsToSetAssociationMixinOptions<T extends Model> extends SaveOptions<Attributes<T>> {
  /**
   * Skip saving this after setting the foreign key if false.
   */
  save?: boolean;
}

/**
 * The setAssociation mixin applied to models with belongsTo.
 * An example of usage is as follows:
 *
 * ```typescript
 * class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
 *  declare setRole: BelongsToSetAssociationMixin<Role, Role['id']>;
 * }
 *
 * User.belongsTo(Role);
 * ```
 *
 * @see Model.belongsTo
 *
 * @typeParam TargetKeyType The type of the attribute that the foreign key references.
 */
export type BelongsToSetAssociationMixin<T extends Model, TargetKeyType> = (
  newAssociation?: T | TargetKeyType,
  options?: BelongsToSetAssociationMixinOptions<T>
) => Promise<void>;

/**
 * The options for the createAssociation mixin of the belongsTo association.
 *
 * @see BelongsToCreateAssociationMixin
 */
export interface BelongsToCreateAssociationMixinOptions<T extends Model>
  extends CreateOptions<Attributes<T>>, BelongsToSetAssociationMixinOptions<T> {}

/**
 * The createAssociation mixin applied to models with belongsTo.
 * An example of usage is as follows:
 *
 * ```typescript
 * class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
 *   declare createRole: BelongsToCreateAssociationMixin<Role>;
 * }
 *
 * User.belongsTo(Role);
 * ```
 *
 * @see Model.belongsTo
 */
export type BelongsToCreateAssociationMixin<T extends Model> = (
  values?: CreationAttributes<T>,
  options?: BelongsToCreateAssociationMixinOptions<T>
) => Promise<T>;
