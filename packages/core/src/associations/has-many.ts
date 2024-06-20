import type { AllowIterable } from '@sequelize/utils';
import { isPlainObject } from '@sequelize/utils';
import isObject from 'lodash/isObject';
import upperFirst from 'lodash/upperFirst';
import type { WhereOptions } from '../abstract-dialect/where-sql-builder-types.js';
import { AssociationError } from '../errors/index.js';
import { col } from '../expression-builders/col.js';
import { fn } from '../expression-builders/fn.js';
import type {
  AttributeNames,
  Attributes,
  CreateOptions,
  CreationAttributes,
  DestroyOptions,
  Filterable,
  FindOptions,
  InstanceUpdateOptions,
  Model,
  ModelStatic,
  Transactionable,
  UpdateValues,
} from '../model';
import { Op } from '../operators';
import { isSameInitialModel } from '../utils/model-utils.js';
import { removeUndefined } from '../utils/object.js';
import type {
  Association,
  AssociationOptions,
  MultiAssociationAccessors,
  MultiAssociationOptions,
} from './base';
import { MultiAssociation } from './base';
import { BelongsToAssociation } from './belongs-to.js';
import type { AssociationStatic, NormalizeBaseAssociationOptions } from './helpers';
import {
  defineAssociation,
  mixinMethods,
  normalizeBaseAssociationOptions,
  normalizeInverseAssociation,
} from './helpers';

/**
 * One-to-many association.
 * See {@link Model.hasMany}
 *
 * Like with {@link HasOneAssociation}, the foreign key will be defined on the target model.
 *
 * In the API reference below, add the name of the association to the method, e.g. for `User.hasMany(Project)` the getter will be `user.getProjects()`.
 * If the association is aliased, use the alias instead, e.g. `User.hasMany(Project, { as: 'jobs' })` will be `user.getJobs()`.
 *
 * @typeParam S The model on which {@link Model.hasMany} has been called, on which the association methods will be added.
 * @typeParam T The model passed to {@link Model.hasMany}. This model will receive the Foreign Key attribute.
 * @typeParam SourceKey The name of the attribute that the foreign key in the target model will reference.
 * @typeParam TargetKey The name of the Foreign Key attribute on the Target model.
 * @typeParam TargetPrimaryKey The name of the Primary Key attribute of the Target model. Used by {@link HasManySetAssociationsMixin} & others.
 */
// Note: this class is named HasManyAssociation instead of HasMany to prevent naming conflicts with the HasMany decorator
export class HasManyAssociation<
  S extends Model = Model,
  T extends Model = Model,
  SourceKey extends AttributeNames<S> = any,
  TargetKey extends AttributeNames<T> = any,
  TargetPrimaryKey extends AttributeNames<T> = any,
> extends MultiAssociation<
  S,
  T,
  TargetKey,
  TargetPrimaryKey,
  NormalizedHasManyOptions<SourceKey, TargetKey>
> {
  accessors: MultiAssociationAccessors;

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
   *
   * This key is on the Source Model.
   * The {@link Association.foreignKey} is on the Target Model.
   */
  get sourceKey(): SourceKey {
    return this.inverse.targetKey;
  }

  /**
   * @deprecated use {@link sourceKey}
   */
  get sourceKeyAttribute(): SourceKey {
    return this.sourceKey;
  }

  get sourceKeyField(): string {
    return this.inverse.targetKeyField;
  }

  readonly inverse: BelongsToAssociation<T, S, TargetKey, SourceKey>;

  constructor(
    secret: symbol,
    source: ModelStatic<S>,
    target: ModelStatic<T>,
    options: NormalizedHasManyOptions<SourceKey, TargetKey>,
    parent?: Association,
    inverse?: BelongsToAssociation<T, S, TargetKey, SourceKey>,
  ) {
    if (options.sourceKey && !source.getAttributes()[options.sourceKey]) {
      throw new Error(
        `Unknown attribute "${options.sourceKey}" passed as sourceKey, define this attribute on model "${source.name}" first`,
      );
    }

    if ('keyType' in options) {
      throw new TypeError(
        'Option "keyType" has been removed from the BelongsTo\'s options. Set "foreignKey.type" instead.',
      );
    }

    if ('through' in options) {
      throw new Error(
        'The "through" option is not available in hasMany. N:M associations are defined using belongsToMany instead.',
      );
    }

    super(secret, source, target, options, parent);

    this.inverse =
      inverse ??
      BelongsToAssociation.associate(
        secret,
        target,
        source,
        removeUndefined({
          as: options.inverse?.as,
          scope: options.inverse?.scope,
          foreignKey: options.foreignKey,
          targetKey: options.sourceKey,
          foreignKeyConstraints: options.foreignKeyConstraints,
          hooks: options.hooks,
        }),
        this,
      );

    // Get singular and plural names
    // try to uppercase the first letter, unless the model forbids it
    const plural = upperFirst(this.options.name.plural);
    const singular = upperFirst(this.options.name.singular);

    this.accessors = {
      get: `get${plural}`,
      set: `set${plural}`,
      addMultiple: `add${plural}`,
      add: `add${singular}`,
      create: `create${singular}`,
      remove: `remove${singular}`,
      removeMultiple: `remove${plural}`,
      hasSingle: `has${singular}`,
      hasAll: `has${plural}`,
      count: `count${plural}`,
    };

    this.#mixin(source.prototype);
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
    options: HasManyOptions<SourceKey, TargetKey> = {},
    parent?: Association<any>,
    inverse?: BelongsToAssociation<T, S, TargetKey, SourceKey>,
  ): HasManyAssociation<S, T, SourceKey, TargetKey> {
    return defineAssociation<
      HasManyAssociation<S, T, SourceKey, TargetKey>,
      HasManyOptions<SourceKey, TargetKey>,
      NormalizedHasManyOptions<SourceKey, TargetKey>
    >(
      HasManyAssociation,
      source,
      target,
      options,
      parent,
      normalizeHasManyOptions,
      normalizedOptions => {
        // self-associations must always set their 'as' parameter
        if (
          isSameInitialModel(source, target) &&
          // use 'options' because this will always be set in 'normalizedOptions'
          (!options.as ||
            !normalizedOptions.inverse?.as ||
            options.as === normalizedOptions.inverse.as)
        ) {
          throw new AssociationError(
            'Both options "as" and "inverse.as" must be defined for hasMany self-associations, and their value must be different.',
          );
        }

        return new HasManyAssociation(secret, source, target, normalizedOptions, parent, inverse);
      },
    );
  }

  #mixin(mixinTargetPrototype: Model) {
    mixinMethods(
      this,
      mixinTargetPrototype,
      [
        'get',
        'count',
        'hasSingle',
        'hasAll',
        'set',
        'add',
        'addMultiple',
        'remove',
        'removeMultiple',
        'create',
      ],
      {
        hasSingle: 'has',
        hasAll: 'has',
        addMultiple: 'add',
        removeMultiple: 'remove',
      },
    );
  }

  /**
   * Get everything currently associated with this, using an optional where clause.
   *
   * @param instances source instances
   * @param options find options
   */
  async get(instances: S, options?: HasManyGetAssociationsMixinOptions<T>): Promise<T[]>;
  async get(
    instances: S[],
    options?: HasManyGetAssociationsMixinOptions<T>,
  ): Promise<Map<any, T[]>>;
  async get(
    instances: S | S[],
    options: HasManyGetAssociationsMixinOptions<T> = {},
  ): Promise<T[] | Map<any, T[]>> {
    let isManyMode = true;
    if (!Array.isArray(instances)) {
      isManyMode = false;
      instances = [instances];
    }

    const findOptions: FindOptions = { ...options };

    const where = Object.create(null);

    // TODO: scopes should be combined using AND instance of overwriting.
    if (this.scope) {
      Object.assign(where, this.scope);
    }

    let values;
    if (instances.length > 1) {
      values = instances.map(instance => instance.get(this.sourceKey, { raw: true }));

      if (findOptions.limit && instances.length > 1) {
        findOptions.groupedLimit = {
          limit: findOptions.limit,
          on: this, // association
          values,
        };

        delete findOptions.limit;
      } else {
        where[this.foreignKey] = {
          [Op.in]: values,
        };
        delete findOptions.groupedLimit;
      }
    } else {
      where[this.foreignKey] = instances[0].get(this.sourceKey, { raw: true });
    }

    findOptions.where = findOptions.where ? { [Op.and]: [where, findOptions.where] } : where;

    let Model = this.target;
    if (options.scope != null) {
      if (!options.scope) {
        Model = Model.withoutScope();
      } else if (options.scope !== true) {
        // 'true' means default scope. Which is the same as not doing anything.
        Model = Model.withScope(options.scope);
      }
    }

    if (options.schema != null) {
      Model = Model.withSchema({
        schema: options.schema,
        schemaDelimiter: options.schemaDelimiter,
      });
    }

    const results = await Model.findAll(findOptions);
    if (!isManyMode) {
      return results;
    }

    const result = new Map<any, T[]>();
    for (const instance of instances) {
      result.set(instance.get(this.sourceKey, { raw: true }), []);
    }

    for (const instance of results) {
      const value = instance.get(this.foreignKey, { raw: true });
      result.get(value)!.push(instance);
    }

    return result;
  }

  /**
   * Count everything currently associated with this, using an optional where clause.
   *
   * @param instance the source instance
   * @param options find & count options
   */
  async count(instance: S, options?: HasManyCountAssociationsMixinOptions<T>): Promise<number> {
    const findOptions: HasManyGetAssociationsMixinOptions<T> = {
      ...options,
      raw: true,
      plain: true,
      attributes: [
        [fn('COUNT', col(`${this.target.name}.${this.target.primaryKeyField}`)), 'count'],
      ],
    };

    const result = await this.get(instance, findOptions);

    return Number.parseInt(
      // @ts-expect-error -- this.get() isn't designed to expect returning a raw output.
      result.count,
      10,
    );
  }

  /**
   * Check if one or more rows are associated with `this`.
   *
   * @param sourceInstance the source instance
   * @param targets A list of instances or their primary keys
   * @param options Options passed to getAssociations
   */
  async has(
    sourceInstance: S,
    targets: AllowIterable<T | Exclude<T[TargetPrimaryKey], any[]>>,
    options?: HasManyHasAssociationsMixinOptions<T>,
  ): Promise<boolean> {
    const normalizedTargets = this.toInstanceOrPkArray(targets);

    const where = {
      [Op.or]: normalizedTargets.map(instance => {
        if (instance instanceof this.target) {
          // TODO: remove eslint-disable once we drop support for < 5.2
          // eslint-disable-next-line @typescript-eslint/prefer-ts-expect-error -- TS 5.2 works, but < 5.2 does not
          // @ts-ignore
          return instance.where();
        }

        return {
          // TODO: support composite foreign keys
          // @ts-expect-error -- TODO: what if the target has no primary key?
          [this.target.primaryKeyAttribute]: instance,
        };
      }),
    };

    const findOptions: HasManyGetAssociationsMixinOptions<T> = {
      ...options,
      scope: false,
      // TODO: support composite foreign keys
      // @ts-expect-error -- TODO: what if the target has no primary key?
      attributes: [this.target.primaryKeyAttribute],
      raw: true,
      // @ts-expect-error -- TODO: current WhereOptions typings do not allow having 'WhereOptions' inside another 'WhereOptions'
      where: {
        [Op.and]: [where, options?.where],
      },
    };

    const associatedObjects = await this.get(sourceInstance, findOptions);

    return associatedObjects.length === normalizedTargets.length;
  }

  /**
   * Set the associated models by passing an array of persisted instances or their primary keys. Everything that is not in the passed array will be un-associated
   *
   * @param sourceInstance source instance to associate new instances with
   * @param targets An array of persisted instances or primary key of instances to associate with this. Pass `null` to remove all associations.
   * @param options Options passed to `target.findAll` and `update`.
   */
  async set(
    sourceInstance: S,
    targets: AllowIterable<T | Exclude<T[TargetPrimaryKey], any[]>> | null,
    options?: HasManySetAssociationsMixinOptions<T>,
  ): Promise<void> {
    const normalizedTargets = this.toInstanceArray(targets);

    const oldAssociations = await this.get(sourceInstance, { ...options, scope: false, raw: true });
    const promises: Array<Promise<any>> = [];
    const obsoleteAssociations = oldAssociations.filter(old => {
      return !normalizedTargets.some(obj => {
        // @ts-expect-error -- old is a raw result
        return obj.get(this.target.primaryKeyAttribute) === old[this.target.primaryKeyAttribute];
      });
    });

    const unassociatedObjects = normalizedTargets.filter(obj => {
      return !oldAssociations.some(old => {
        // @ts-expect-error -- old is a raw result
        return obj.get(this.target.primaryKeyAttribute) === old[this.target.primaryKeyAttribute];
      });
    });

    if (obsoleteAssociations.length > 0) {
      promises.push(
        this.remove(sourceInstance, obsoleteAssociations, {
          ...options,
          destroy: options?.destroyPrevious,
        }),
      );
    }

    if (unassociatedObjects.length > 0) {
      const update = {
        [this.foreignKey]: sourceInstance.get(this.sourceKey),
        ...this.scope,
      } as UpdateValues<T>;

      const updateWhere = {
        // @ts-expect-error -- TODO: what if the target has no primary key?
        [this.target.primaryKeyAttribute]: unassociatedObjects.map(unassociatedObject => {
          // @ts-expect-error -- TODO: what if the target has no primary key?
          return unassociatedObject.get(this.target.primaryKeyAttribute);
        }),
      };

      promises.push(
        this.target.withoutScope().update(update, {
          ...options,
          where: updateWhere,
        }),
      );
    }

    await Promise.all(promises);
  }

  /**
   * Associate one or more target rows with `this`. This method accepts a Model / string / number to associate a single row,
   * or a mixed array of Model / string / numbers to associate multiple rows.
   *
   * @param sourceInstance the source instance
   * @param [rawTargetInstances] A single instance or primary key, or a mixed array of persisted instances or primary keys
   * @param [options] Options passed to `target.update`.
   */
  async add(
    sourceInstance: S,
    rawTargetInstances: AllowIterable<T | Exclude<T[TargetPrimaryKey], any[]>>,
    options: HasManyAddAssociationsMixinOptions<T> = {},
  ): Promise<void> {
    const targetInstances = this.toInstanceArray(rawTargetInstances);

    if (targetInstances.length === 0) {
      return;
    }

    const update = {
      [this.foreignKey]: sourceInstance.get(this.sourceKey),
      ...this.scope,
    } as UpdateValues<T>;

    const where = {
      // @ts-expect-error -- TODO: what if the target has no primary key?
      [this.target.primaryKeyAttribute]: targetInstances.map(unassociatedObject => {
        // @ts-expect-error -- TODO: what if the target has no primary key?
        return unassociatedObject.get(this.target.primaryKeyAttribute);
      }),
    };

    await this.target.withoutScope().update(update, { ...options, where });
  }

  /**
   * Un-associate one or several target rows.
   *
   * @param sourceInstance instance to un associate instances with
   * @param targets Can be an Instance or its primary key, or a mixed array of instances and primary keys
   * @param options Options passed to `target.update`
   */
  async remove(
    sourceInstance: S,
    targets: AllowIterable<T | Exclude<T[TargetPrimaryKey], any[]>>,
    options: HasManyRemoveAssociationsMixinOptions<T> = {},
  ): Promise<void> {
    if (targets == null) {
      return;
    }

    const normalizedTargets = this.toInstanceOrPkArray(targets);
    if (normalizedTargets.length === 0) {
      return;
    }

    const where: WhereOptions = {
      [this.foreignKey]: sourceInstance.get(this.sourceKey),
      // @ts-expect-error -- TODO: what if the target has no primary key?
      [this.target.primaryKeyAttribute]: normalizedTargets.map(targetInstance => {
        if (targetInstance instanceof this.target) {
          // @ts-expect-error -- TODO: what if the target has no primary key?
          return targetInstance.get(this.target.primaryKeyAttribute);
        }

        // raw entity
        // @ts-expect-error -- TODO: what if the target has no primary key?
        if (isPlainObject(targetInstance) && this.target.primaryKeyAttribute in targetInstance) {
          // @ts-expect-error -- implicit any, can't be fixed
          return targetInstance[this.target.primaryKeyAttribute];
        }

        // primary key
        return targetInstance;
      }),
    };

    const foreignKeyIsNullable =
      this.target.modelDefinition.attributes.get(this.foreignKey)?.allowNull ?? true;

    if (options.destroy || !foreignKeyIsNullable) {
      await this.target.withoutScope().destroy({
        ...(isObject(options.destroy) ? options.destroy : undefined),
        logging: options.logging,
        benchmark: options.benchmark,
        transaction: options.transaction,
        where,
      });
    } else {
      const update = {
        [this.foreignKey]: null,
      } as UpdateValues<T>;

      await this.target.withoutScope().update(update, { ...options, where });
    }
  }

  /**
   * Create a new instance of the associated model and associate it with this.
   *
   * @param sourceInstance source instance
   * @param values values for target model instance
   * @param options Options passed to `target.create`
   */
  async create(
    sourceInstance: S,
    // @ts-expect-error -- {} is not always assignable to 'values', but Target.create will enforce this, not us.
    values: CreationAttributes<T> = {},
    options:
      | HasManyCreateAssociationMixinOptions<T>
      | HasManyCreateAssociationMixinOptions<T>['fields'] = {},
  ): Promise<T> {
    if (Array.isArray(options)) {
      options = {
        fields: options,
      };
    }

    if (this.scope) {
      for (const attribute of Object.keys(this.scope)) {
        // @ts-expect-error -- TODO: fix the typing of {@link AssociationScope}
        values[attribute] = this.scope[attribute];
        if (options.fields) {
          options.fields.push(attribute);
        }
      }
    }

    if (options.fields) {
      options.fields.push(this.foreignKey);
    }

    return this.target.create(
      {
        ...values,
        [this.foreignKey]: sourceInstance.get(this.sourceKey),
      },
      options,
    );
  }
}

// workaround https://github.com/evanw/esbuild/issues/1260
Object.defineProperty(HasManyAssociation, 'name', {
  value: 'HasMany',
});

export type NormalizedHasManyOptions<
  SourceKey extends string,
  TargetKey extends string,
> = NormalizeBaseAssociationOptions<Omit<HasManyOptions<SourceKey, TargetKey>, 'inverse'>> & {
  inverse?: Exclude<HasManyOptions<SourceKey, TargetKey>['inverse'], string>;
};

/**
 * Options provided when associating models with hasMany relationship
 */
export interface HasManyOptions<SourceKey extends string, TargetKey extends string>
  extends MultiAssociationOptions<TargetKey> {
  /**
   * The name of the field to use as the key for the association in the source table. Defaults to the primary
   * key of the source table
   */
  sourceKey?: SourceKey;

  /**
   * The name of the inverse association, or an object for further association setup.
   */
  inverse?:
    | string
    | undefined
    | {
        as?: AssociationOptions<any>['as'];
        scope?: AssociationOptions<any>['scope'];
      };
}

function normalizeHasManyOptions<SourceKey extends string, TargetKey extends string>(
  type: AssociationStatic<any>,
  options: HasManyOptions<SourceKey, TargetKey>,
  source: ModelStatic<Model>,
  target: ModelStatic<Model>,
): NormalizedHasManyOptions<SourceKey, TargetKey> {
  return normalizeBaseAssociationOptions(
    type,
    {
      ...options,
      inverse: normalizeInverseAssociation(options.inverse),
    },
    source,
    target,
  );
}

/**
 * The options for the getAssociations mixin of the hasMany association.
 *
 * Can provide an optional where clause to limit the associated models through {@link HasManyGetAssociationsMixinOptions.where}.
 *
 * @see HasManyGetAssociationsMixin
 */
export interface HasManyGetAssociationsMixinOptions<T extends Model>
  extends FindOptions<Attributes<T>> {
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
 * The getAssociations mixin applied to models with hasMany.
 * An example of usage is as follows:
 *
 * ```typescript
 * class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
 *   declare getRoles: HasManyGetAssociationsMixin<Role>;
 * }
 *
 * User.hasMany(Role);
 * ```
 *
 * @see Model.hasMany
 */
export type HasManyGetAssociationsMixin<T extends Model> = (
  options?: HasManyGetAssociationsMixinOptions<T>,
) => Promise<T[]>;

/**
 * The options for the setAssociations mixin of the hasMany association.
 *
 * @see HasManySetAssociationsMixin
 */
export interface HasManySetAssociationsMixinOptions<T extends Model>
  extends FindOptions<Attributes<T>>,
    InstanceUpdateOptions<Attributes<T>> {
  /**
   * Delete the previous associated model. Default to false.
   *
   * Only applies if the foreign key is nullable. If the foreign key is not nullable,
   * the previous associated model is always deleted.
   */
  destroyPrevious?:
    | boolean
    | Omit<DestroyOptions<Attributes<T>>, 'where' | 'transaction' | 'logging' | 'benchmark'>
    | undefined;
}

/**
 * The setAssociations mixin applied to models with hasMany.
 * An example of usage is as follows:
 *
 * ```typescript
 * class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
 *   declare setRoles: HasManySetAssociationsMixin<Role, Role['id']>;
 * }
 *
 * User.hasMany(Role);
 * ```
 *
 * @see Model.hasMany
 */
export type HasManySetAssociationsMixin<T extends Model, TModelPrimaryKey> = (
  newAssociations?: Iterable<T | TModelPrimaryKey> | null,
  options?: HasManySetAssociationsMixinOptions<T>,
) => Promise<void>;

/**
 * The options for the addAssociations mixin of the hasMany association.
 *
 * @see HasManyAddAssociationsMixin
 */
export interface HasManyAddAssociationsMixinOptions<T extends Model>
  extends InstanceUpdateOptions<Attributes<T>> {}

/**
 * The addAssociations mixin applied to models with hasMany.
 * An example of usage is as follows:
 *
 * ```typescript
 * class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
 *   declare addRoles: HasManyAddAssociationsMixin<Role, Role['id']>;
 * }
 *
 * User.hasMany(Role);
 * ```
 *
 * @see Model.hasMany
 */
export type HasManyAddAssociationsMixin<T extends Model, TModelPrimaryKey> = (
  newAssociations?: Iterable<T | TModelPrimaryKey>,
  options?: HasManyAddAssociationsMixinOptions<T>,
) => Promise<void>;

/**
 * The options for the addAssociation mixin of the hasMany association.
 *
 * @see HasManyAddAssociationMixin
 */
export interface HasManyAddAssociationMixinOptions<T extends Model>
  extends HasManyAddAssociationsMixinOptions<T> {}

/**
 * The addAssociation mixin applied to models with hasMany.
 * An example of usage is as follows:
 *
 * ```typescript
 * class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
 *   declare addRole: HasManyAddAssociationMixin<Role, Role['id']>;
 * }
 *
 * User.hasMany(Role);
 * ```
 *
 * @see Model.hasMany
 */
export type HasManyAddAssociationMixin<T extends Model, TModelPrimaryKey> = (
  newAssociation?: T | TModelPrimaryKey,
  options?: HasManyAddAssociationMixinOptions<T>,
) => Promise<void>;

/**
 * The options for the createAssociation mixin of the hasMany association.
 *
 * @see HasManyCreateAssociationMixin
 */
export interface HasManyCreateAssociationMixinOptions<T extends Model>
  extends CreateOptions<Attributes<T>> {}

/**
 * The createAssociation mixin applied to models with hasMany.
 * An example of usage is as follows:
 *
 * ```typescript
 * class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
 *   declare createRole: HasManyCreateAssociationMixin<Role>;
 * }
 *
 * User.hasMany(Role);
 * ```
 *
 * @see Model.hasMany
 */
export type HasManyCreateAssociationMixin<
  Target extends Model,
  ExcludedAttributes extends keyof CreationAttributes<Target> = never,
> = (
  values?: Omit<CreationAttributes<Target>, ExcludedAttributes>,
  options?: HasManyCreateAssociationMixinOptions<Target>,
) => Promise<Target>;

/**
 * The options for the removeAssociation mixin of the hasMany association.
 *
 * @see HasManyRemoveAssociationMixin
 */
export interface HasManyRemoveAssociationMixinOptions<T extends Model>
  extends HasManyRemoveAssociationsMixinOptions<T> {}

/**
 * The removeAssociation mixin applied to models with hasMany.
 * An example of usage is as follows:
 *
 * ```typescript
 * class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
 *   declare removeRole: HasManyRemoveAssociationMixin<Role, Role['id']>;
 * }
 *
 * User.hasMany(Role);
 * ```
 *
 * @see Model.hasMany
 */
export type HasManyRemoveAssociationMixin<T extends Model, TModelPrimaryKey> = (
  oldAssociated?: T | TModelPrimaryKey,
  options?: HasManyRemoveAssociationMixinOptions<T>,
) => Promise<void>;

/**
 * The options for the removeAssociations mixin of the hasMany association.
 *
 * @see HasManyRemoveAssociationsMixin
 */
export interface HasManyRemoveAssociationsMixinOptions<T extends Model>
  extends Omit<InstanceUpdateOptions<Attributes<T>>, 'where'> {
  /**
   * Delete the associated model. Default to false.
   *
   * Only applies if the foreign key is nullable. If the foreign key is not nullable,
   * the associated model is always deleted.
   */
  destroy?:
    | boolean
    | Omit<DestroyOptions<Attributes<T>>, 'where' | 'transaction' | 'logging' | 'benchmark'>
    | undefined;
}

/**
 * The removeAssociations mixin applied to models with hasMany.
 * An example of usage is as follows:
 *
 * ```typescript
 * class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
 *   declare removeRoles: HasManyRemoveAssociationsMixin<Role, Role['id']>;
 * }
 *
 * User.hasMany(Role);
 * ```
 *
 * @see Model.hasMany
 */
export type HasManyRemoveAssociationsMixin<T extends Model, TModelPrimaryKey> = (
  oldAssociateds?: Iterable<T | TModelPrimaryKey>,
  options?: HasManyRemoveAssociationsMixinOptions<T>,
) => Promise<void>;

/**
 * The options for the hasAssociation mixin of the hasMany association.
 *
 * @see HasManyHasAssociationMixin
 */
export interface HasManyHasAssociationMixinOptions<T extends Model>
  extends HasManyGetAssociationsMixinOptions<T> {}

/**
 * The hasAssociation mixin applied to models with hasMany.
 * An example of usage is as follows:
 *
 * ```typescript
 * class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
 *   declare hasRole: HasManyHasAssociationMixin<Role, Role['id']>;
 * }
 *
 * User.hasMany(Role);
 * ```
 *
 * @see Model.hasMany
 */
export type HasManyHasAssociationMixin<TModel extends Model, TModelPrimaryKey> = (
  target: TModel | TModelPrimaryKey,
  options?: HasManyHasAssociationMixinOptions<TModel>,
) => Promise<boolean>;

/**
 * The options for the hasAssociations mixin of the hasMany association.
 *
 * @see HasManyHasAssociationsMixin
 */
export interface HasManyHasAssociationsMixinOptions<T extends Model>
  extends HasManyGetAssociationsMixinOptions<T> {}

/**
 * The removeAssociations mixin applied to models with hasMany.
 * An example of usage is as follows:
 *
 * ```typescript
 * class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
 *   declare hasRoles: HasManyHasAssociationsMixin<Role, Role['id']>;
 * }
 *
 * User.hasMany(Role);
 * ```
 *
 * @see Model.hasMany
 */
// TODO: this should be renamed to "HasManyHasAllAssociationsMixin",
//       we should also add a "HasManyHasAnyAssociationsMixin"
//       and "HasManyHasAssociationsMixin" should instead return a Map of id -> boolean or WeakMap of instance -> boolean
export type HasManyHasAssociationsMixin<TModel extends Model, TModelPrimaryKey> = (
  targets: Iterable<TModel | TModelPrimaryKey>,
  options?: HasManyHasAssociationsMixinOptions<TModel>,
) => Promise<boolean>;

/**
 * The options for the countAssociations mixin of the hasMany association.
 *
 * @see HasManyCountAssociationsMixin
 */
export interface HasManyCountAssociationsMixinOptions<T extends Model>
  extends Transactionable,
    Filterable<Attributes<T>> {
  /**
   * Apply a scope on the related model, or remove its default scope by passing false.
   */
  scope?: string | boolean;
}

/**
 * The countAssociations mixin applied to models with hasMany.
 * An example of usage is as follows:
 *
 * ```typescript
 * class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
 *   declare countRoles: HasManyCountAssociationsMixin<Role>;
 * }
 *
 * User.hasMany(Role);
 * ```
 *
 * @see Model.hasMany
 */
export type HasManyCountAssociationsMixin<T extends Model> = (
  options?: HasManyCountAssociationsMixinOptions<T>,
) => Promise<number>;
