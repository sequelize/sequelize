import upperFirst from 'lodash/upperFirst';
import { AssociationError } from '../errors/index.js';
import { Model } from '../model';
import type {
  CreateOptions,
  CreationAttributes,
  FindOptions,
  SaveOptions,
  ModelStatic,
  AttributeNames,
  Attributes,
} from '../model';
import { Op } from '../operators';
import * as Utils from '../utils';
import { isSameInitialModel } from '../utils/model-utils.js';
import type { AssociationOptions, SingleAssociationAccessors } from './base';
import { Association } from './base';
import { BelongsTo } from './belongs-to.js';
import type { NormalizeBaseAssociationOptions } from './helpers';
import {
  defineAssociation,
  mixinMethods, normalizeBaseAssociationOptions,
} from './helpers';

/**
 * One-to-one association.
 * See {@link Model.hasOne}
 *
 * This is almost the same as {@link BelongsTo}, but the foreign key will be defined on the target model.
 *
 * In the API reference below, add the name of the association to the method, e.g. for `User.hasOne(Project)` the getter will be `user.getProject()`.
 *
 * @typeParam S The model on which {@link Model.hasOne} has been called, on which the association methods will be added.
 * @typeParam T The model passed to {@link Model.hasOne}. This model will receive the Foreign Key attribute.
 * @typeParam SourceKey The name of the attribute that the foreign key in the target model will reference.
 * @typeParam TargetKey The name of the Foreign Key attribute on the Target model.
 * @typeParam TargetPrimaryKey The name of the Primary Key attribute of the Target model. Used by {@link HasOneSetAssociationMixin}.
 */
export class HasOne<
  S extends Model = Model,
  T extends Model = Model,
  SourceKey extends AttributeNames<S> = any,
  TargetKey extends AttributeNames<T> = any,
  TargetPrimaryKey extends AttributeNames<T> = any,
> extends Association<S, T, TargetKey, NormalizedHasOneOptions<SourceKey, TargetKey>> {

  get foreignKey(): TargetKey {
    return this.inverse.foreignKey;
  }

  /**
   * The column name of the foreign key (on the target model)
   */
  get identifierField(): string {
    return this.inverse.identifierField;
  }

  /**
   * The name of the attribute the foreign key points to.
   * In HasOne, it is on the Source Model, instead of the Target Model (unlike {@link BelongsTo.targetKey}).
   * The {@link Association.foreignKey} is on the Target Model.
   */
  get sourceKey(): SourceKey {
    return this.inverse.targetKey;
  }

  /**
   * The Column Name of the source key.
   */
  get sourceKeyField(): string {
    return this.inverse.targetKeyField;
  }

  /**
   * @deprecated use {@link sourceKey}
   */
  get sourceKeyAttribute(): SourceKey {
    return this.sourceKey;
  }

  readonly inverse: BelongsTo<T, S, TargetKey, SourceKey>;

  readonly accessors: SingleAssociationAccessors;

  constructor(
    secret: symbol,
    source: ModelStatic<S>,
    target: ModelStatic<T>,
    options: NormalizedHasOneOptions<SourceKey, TargetKey>,
    parent?: Association,
  ) {
    if (
      options?.sourceKey
      && !source.getAttributes()[options.sourceKey]
    ) {
      throw new Error(`Unknown attribute "${options.sourceKey}" passed as sourceKey, define this attribute on model "${source.name}" first`);
    }

    if ('keyType' in options) {
      throw new TypeError('Option "keyType" has been removed from the BelongsTo\'s options. Set "foreignKey.type" instead.');
    }

    // TODO: throw is source model has a composite primary key.

    super(secret, source, target, options, parent);

    this.inverse = BelongsTo.associate(secret, target, source, {
      as: options.inverse?.as,
      scope: options.inverse?.scope,
      foreignKey: options.foreignKey,
      targetKey: options.sourceKey,
      foreignKeyConstraints: options.foreignKeyConstraints,
      hooks: options.hooks,
    }, this);

    // Get singular name, trying to uppercase the first letter, unless the model forbids it
    const singular = upperFirst(this.options.name.singular);

    this.accessors = {
      get: `get${singular}`,
      set: `set${singular}`,
      create: `create${singular}`,
    };

    this.#mixin(source.prototype);
  }

  #mixin(mixinTargetPrototype: Model) {
    mixinMethods(this, mixinTargetPrototype, ['get', 'set', 'create']);
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
    options: HasOneOptions<SourceKey, TargetKey> = {},
    parent?: Association<any>,
  ): HasOne<S, T, SourceKey, TargetKey> {
    return defineAssociation<
      HasOne<S, T, SourceKey, TargetKey>,
      HasOneOptions<SourceKey, TargetKey>,
      NormalizedHasOneOptions<SourceKey, TargetKey>
    >(HasOne, source, target, options, parent, normalizeBaseAssociationOptions, normalizedOptions => {
      // self-associations must always set their 'as' parameter
      if (isSameInitialModel(source, target)
        // use 'options' because this will always be set in 'newOptions'
        && (!options.as || !options.inverse?.as || options.as === options.inverse.as)) {
        throw new AssociationError(`Both options "as" and "inverse.as" must be defined for hasOne self-associations, and their value must be different.
This is because hasOne associations automatically create the corresponding belongsTo association, but they cannot share the same name.

If having two associations does not make sense (for instance a "spouse" association from user to user), consider using belongsTo instead of hasOne.`);
      }

      return new HasOne(secret, source, target, normalizedOptions, parent);
    });
  }

  /**
   * Get the associated instance.
   *
   * See {@link HasOneGetAssociationMixinOptions} for a full explanation of options.
   * This method is mixed-in the source model prototype. See {@link HasOneGetAssociationMixin}.
   *
   * @param instances source instances
   * @param options find options
   */
  async get(instances: S, options?: HasOneGetAssociationMixinOptions<T>): Promise<T | null>;
  async get(instances: S[], options?: HasOneGetAssociationMixinOptions<T>): Promise<Map<any, T | null>>;
  async get(
    instances: S | S[],
    options?: HasOneGetAssociationMixinOptions<T>,
  ): Promise<Map<any, T | null> | T | null> {
    options = options ? Utils.cloneDeep(options) : {};

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

    const where = Object.create(null);

    if (instances.length > 1) {
      where[this.foreignKey] = {
        [Op.in]: instances.map(instance => instance.get(this.sourceKey)),
      };
    } else {
      where[this.foreignKey] = instances[0].get(this.sourceKey);
    }

    if (this.scope) {
      Object.assign(where, this.scope);
    }

    options.where = options.where
      ? { [Op.and]: [where, options.where] }
      : where;

    if (isManyMode) {
      const results = await Target.findAll(options);
      const result: Map<any, T | null> = new Map();

      for (const targetInstance of results) {
        result.set(targetInstance.get(this.foreignKey, { raw: true }), targetInstance);
      }

      return result;
    }

    return Target.findOne(options);
  }

  /**
   * Set the associated model.
   *
   * @param sourceInstance the source instance
   * @param associatedInstanceOrPk An persisted instance or the primary key of an instance to associate with this. Pass `null` to remove the association.
   * @param options Options passed to getAssociation and `target.save`
   *
   * @returns The associated instance, or null if disassociated.
   */
  async set(
    sourceInstance: S, associatedInstanceOrPk: T | T[TargetPrimaryKey], options?: HasOneSetAssociationMixinOptions<T>,
  ): Promise<T>;
  async set(sourceInstance: S, associatedInstanceOrPk: null, options?: HasOneSetAssociationMixinOptions<T>): Promise<null>;
  async set(
    sourceInstance: S,
    associatedInstanceOrPk: T | T[TargetPrimaryKey] | null,
    options?: HasOneSetAssociationMixinOptions<T>,
  ): Promise<T | null> {
    options = { ...options, scope: false };

    // @ts-expect-error -- .save isn't listed in the options because it's not supported, but we'll still warn users if they use it.
    if (options.save === false) {
      throw new Error(`The "save: false" option cannot be honoured in ${this.source.name}#${this.accessors.set}
because, as this is a hasOne association, the foreign key we need to update is located on the model ${this.target.name}.`);
    }

    // calls the 'get' mixin
    const oldInstance: T | null = await this.get(sourceInstance, options);

    const alreadyAssociated = !oldInstance || !associatedInstanceOrPk ? false
      : associatedInstanceOrPk instanceof Model ? associatedInstanceOrPk.equals(oldInstance)
      : oldInstance.get(this.target.primaryKeyAttribute) === associatedInstanceOrPk;

    if (alreadyAssociated) {
      if (associatedInstanceOrPk instanceof Model) {
        return associatedInstanceOrPk;
      }

      return oldInstance;
    }

    if (oldInstance) {
      // TODO: if foreign key cannot be null, delete instead (maybe behind flag) - https://github.com/sequelize/sequelize/issues/14048
      oldInstance.set(this.foreignKey, null);

      await oldInstance.save({
        ...options,
        fields: [this.foreignKey],
        association: true,
      });
    }

    if (associatedInstanceOrPk) {
      let associatedInstance: T;
      if (associatedInstanceOrPk instanceof this.target) {
        associatedInstance = associatedInstanceOrPk as T;
      } else {
        const tmpInstance = Object.create(null);
        tmpInstance[this.target.primaryKeyAttribute] = associatedInstanceOrPk;
        associatedInstance = this.target.build(tmpInstance, {
          isNewRecord: false,
        });
      }

      Object.assign(associatedInstance, this.scope);
      associatedInstance.set(this.foreignKey, sourceInstance.get(this.sourceKeyAttribute));

      return associatedInstance.save(options);
    }

    // disassociated
    return null;
  }

  /**
   * Create a new instance of the associated model and associate it with this.
   *
   * See {@link Model#create} for a full explanation of options.
   *
   * @param sourceInstance - the source instance
   * @param values - values to create associated model instance with
   * @param options - Options passed to `target.create` and setAssociation.
   *
   * @returns The created target model
   */
  async create(
    sourceInstance: S,
    // @ts-expect-error -- {} is not always assignable to 'values', but Target.create will enforce this, not us.
    values: CreationAttributes<T> = {},
    options: HasOneCreateAssociationMixinOptions<T> = {},
  ): Promise<T> {

    if (this.scope) {
      for (const attribute of Object.keys(this.scope)) {
        // @ts-expect-error
        values[attribute] = this.scope[attribute];
        if (options.fields) {
          options.fields.push(attribute);
        }
      }
    }

    // @ts-expect-error
    values[this.foreignKey] = sourceInstance.get(this.sourceKeyAttribute);
    if (options.fields) {
      options.fields.push(this.foreignKey);
    }

    return this.target.create(values, options);
  }
}

// workaround https://github.com/evanw/esbuild/issues/1260
Object.defineProperty(HasOne, 'name', {
  value: 'HasOne',
});

export type NormalizedHasOneOptions<SourceKey extends string, TargetKey extends string> =
  NormalizeBaseAssociationOptions<HasOneOptions<SourceKey, TargetKey>>;

/**
 * Options provided when associating models with hasOne relationship
 */
export interface HasOneOptions<SourceKey extends string, TargetKey extends string> extends AssociationOptions<TargetKey> {

  /**
   * The name of the field to use as the key for the association in the source table.
   * Defaults to the primary key of the source table.
   *
   * This is the attribute the foreign key will target. Not to be confused with {@link AssociationOptions.foreignKey}.
   */
  sourceKey?: SourceKey;

  inverse?: {
    as?: AssociationOptions<any>['as'],
    scope?: AssociationOptions<any>['scope'],
  };
}

/**
 * The options for the getAssociation mixin of the hasOne association.
 *
 * @see HasOneGetAssociationMixin
 */
export interface HasOneGetAssociationMixinOptions<T extends Model> extends FindOptions<Attributes<T>> {
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
 * The getAssociation mixin applied to models with hasOne.
 * An example of usage is as follows:
 *
 * ```typescript
 * class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
 *   declare getRole: HasOneGetAssociationMixin<Role>;
 * }
 *
 * User.hasOne(Role);
 * ```
 *
 * @returns The associated model, or null if no model is associated. HasOne associations are always nullable because the foreign key is on the target model.
 *
 * @see Model.hasOne
 */
export type HasOneGetAssociationMixin<
  T extends Model,
> = (options?: HasOneGetAssociationMixinOptions<T>) => Promise<T | null>;

/**
 * The options for the setAssociation mixin of the hasOne association.
 *
 * @see HasOneSetAssociationMixin
 */
export interface HasOneSetAssociationMixinOptions<T extends Model>
  extends HasOneGetAssociationMixinOptions<T>, SaveOptions<Attributes<T>> {
}

/**
 * The setAssociation mixin applied to models with hasOne.
 * An example of usage is as follows:
 *
 * ```typescript
 * class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
 *   declare setRole: HasOneSetAssociationMixin<Role, Role['id']>;
 * }
 *
 * User.hasOne(Role);
 * ```
 *
 * @see Model.hasOne
 */
export type HasOneSetAssociationMixin<T extends Model, TModelPrimaryKey> = {
  (newAssociation: null, options?: HasOneSetAssociationMixinOptions<T>): Promise<null>,
  (newAssociation: T | TModelPrimaryKey, options?: HasOneSetAssociationMixinOptions<T>): Promise<T>,
};

/**
 * The options for the createAssociation mixin of the hasOne association.
 *
 * @see HasOneCreateAssociationMixin
 */
export interface HasOneCreateAssociationMixinOptions<T extends Model>
  extends Omit<HasOneSetAssociationMixinOptions<T>, 'fields'>, CreateOptions<Attributes<T>> {}

/**
 * The createAssociation mixin applied to models with hasOne.
 * An example of usage is as follows:
 *
 * ```typescript
 * class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
 *  declare createRole: HasOneCreateAssociationMixin<Role>;
 * }
 *
 * User.hasOne(Role);
 * ```
 *
 * @see Model.hasOne
 */
export type HasOneCreateAssociationMixin<T extends Model> = (
  // TODO: omit the foreign key from CreationAttributes once we have a way to determine which key is the foreign key in typings
  values?: CreationAttributes<T>,
  options?: HasOneCreateAssociationMixinOptions<T>
) => Promise<T>;
