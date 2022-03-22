import upperFirst from 'lodash/upperFirst';
import type { DataType } from '../data-types';
import type {
  Model,
  CreateOptions,
  CreationAttributes,
  Filterable,
  FindOptions,
  InstanceUpdateOptions,
  Transactionable,
  ModelStatic,
  AttributeNames,
} from '../model';
import { Op } from '../operators';
import { col, fn } from '../sequelize';
import * as Utils from '../utils';
import type { AllowArray } from '../utils';
import type { MultiAssociationAccessors, ManyToManyOptions } from './base';
import { Association } from './base';
import * as Helpers from './helpers';

// TODO: strictly type util options

/**
 * One-to-many association
 *
 * In the API reference below, add the name of the association to the method, e.g. for `User.hasMany(Project)` the getter will be `user.getProjects()`.
 * If the association is aliased, use the alias instead, e.g. `User.hasMany(Project, { as: 'jobs' })` will be `user.getJobs()`.
 *
 * See {@link Model.hasMany}
 */
export class HasMany<
  S extends Model = Model,
  T extends Model = Model,
  SourceKey extends AttributeNames<S> = any,
  TargetKey extends AttributeNames<T> = any,
> extends Association<S, T, HasManyOptions<S>, TargetKey> {
  accessors: MultiAssociationAccessors;
  associationAccessor: string;

  associationType = 'HasMany';
  isMultiAssociation = true;

  identifierField: string | undefined;
  foreignKeyField: string | undefined;

  /**
   * The name of the attribute the foreign key points to.
   *
   * This key is on the Source Model.
   * The {@link Association.foreignKey} is on the Target Model.
   */
  sourceKey: SourceKey;

  sourceKeyAttribute: string;
  sourceKeyField: string;

  constructor(source: ModelStatic<S>, target: ModelStatic<T>, options: HasManyOptions<S>) {
    super(source, target, options);

    if ('through' in this.options) {
      throw new Error('The "through" option is not available in hasMany. N:M associations are defined using belongsToMany instead.');
    }

    if (this.target.getAttributes()[this.foreignKey]) {
      this.identifierField = Utils.getColumnName(this.target.getAttributes()[this.foreignKey]);
      this.foreignKeyField = Utils.getColumnName(this.target.getAttributes()[this.foreignKey]);
    }

    /*
     * Source key setup
     */
    // TODO: throw if source has a compose PK.
    this.sourceKey = this.options.sourceKey || (this.source.primaryKeyAttribute as SourceKey);

    if (this.source.rawAttributes[this.sourceKey]) {
      this.sourceKeyAttribute = this.sourceKey;
      this.sourceKeyField = Utils.getColumnName(this.source.rawAttributes[this.sourceKey]);
    } else {
      this.sourceKeyAttribute = this.source.primaryKeyAttribute;
      this.sourceKeyField = this.source.primaryKeyField;
    }

    // Get singular and plural names
    // try to uppercase the first letter, unless the model forbids it
    const plural = upperFirst(this.options.name.plural);
    const singular = upperFirst(this.options.name.singular);

    this.associationAccessor = this.as;
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
  }

  // the id is in the target table
  // or in an extra table which connects two tables
  _injectAttributes() {
    const newAttributes = {
      [this.foreignKey]: {
        type: this.options.keyType || this.source.rawAttributes[this.sourceKeyAttribute].type,
        allowNull: true,
        ...this.foreignKeyAttribute,
      },
    };

    // Create a new options object for use with addForeignKeyConstraints, to avoid polluting this.options in case it is later used for a n:m
    const constraintOptions = { ...this.options };

    if (this.options.constraints !== false) {
      const target = this.target.rawAttributes[this.foreignKey] || newAttributes[this.foreignKey];
      constraintOptions.onDelete = constraintOptions.onDelete || (target.allowNull ? 'SET NULL' : 'CASCADE');
      constraintOptions.onUpdate = constraintOptions.onUpdate || 'CASCADE';
    }

    Helpers.addForeignKeyConstraints(newAttributes[this.foreignKey], this.source, constraintOptions, this.sourceKeyField);

    this.target.mergeAttributes(newAttributes);
    this.source.refreshAttributes();

    this.identifierField = this.target.rawAttributes[this.foreignKey].field || this.foreignKey;
    this.foreignKeyField = this.target.rawAttributes[this.foreignKey].field || this.foreignKey;
    this.sourceKeyField = this.source.rawAttributes[this.sourceKey].field || this.sourceKey;

    Helpers.checkNamingCollision(this);

    return this;
  }

  mixin(mixinTargetPrototype: Model) {
    Helpers.mixinMethods(
      this,
      mixinTargetPrototype,
      ['get', 'count', 'hasSingle', 'hasAll', 'set', 'add', 'addMultiple', 'remove', 'removeMultiple', 'create'],
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
  // TODO: when is this called with an array? Is it ever?
  async get(instances: S | S[], options: HasManyGetAssociationsMixinOptions = {}) {
    if (!Array.isArray(instances)) {
      instances = [instances];
    }

    const findOptions: FindOptions = { ...options };

    const where = Object.create(null);

    // FIXME: scopes should be combined using AND instance of overwriting.
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

    findOptions.where = findOptions.where
      ? { [Op.and]: [where, findOptions.where] }
      : where;

    let Model = this.target;
    if (options.scope != null) {
      if (!options.scope) {
        Model = Model.unscoped();
      } else if (options.scope !== true) {
        Model = Model.scope(options.scope);
      }
    }

    if (options.schema != null) {
      Model = Model.schema(options.schema, options.schemaDelimiter);
    }

    const results = await Model.findAll(findOptions);
    if (instances.length === 1) {
      return results;
    }

    const result: Record<S[SourceKey], T[]> = Object.create(null);
    for (const instance of instances) {
      result[instance.get(this.sourceKey, { raw: true })] = [];
    }

    for (const instance of results) {
      result[instance.get(this.foreignKey, { raw: true })].push(instance);
    }

    return result;
  }

  /**
   * Count everything currently associated with this, using an optional where clause.
   *
   * @param        instance the source instance
   * @param         [options] find & count options
   * @param         [options.where] An optional where clause to limit the associated models
   * @param [options.scope] Apply a scope on the related model, or remove its default scope by passing false
   */
  async count(instance: S, options?: HasManyCountAssociationsMixinOptions) {
    const findOptions: HasManyGetAssociationsMixinOptions = {
      ...options,
      raw: true,
      plain: true,
      attributes: [
        [
          fn(
            'COUNT',
            col(`${this.target.name}.${this.target.primaryKeyField}`),
          ),
          'count',
        ],
      ],
    };

    const result = await this.get(instance, findOptions);

    return Number.parseInt(result.count, 10);
  }

  /**
   * Check if one or more rows are associated with `this`.
   *
   * @param sourceInstance the source instance
   * @param targetInstances Can be an array of instances or their primary keys
   * @param options Options passed to getAssociations
   */
  async has(sourceInstance: S, targetInstances: T | T[], options: HasManyHasAssociationsMixinOptions) {
    if (!Array.isArray(targetInstances)) {
      targetInstances = [targetInstances];
    }

    const where = {
      [Op.or]: targetInstances.map(instance => {
        if (instance instanceof this.target) {
          return instance.where();
        }

        return {
          [this.target.primaryKeyAttribute]: instance,
        };
      }),
    };

    const findOptions: HasManyGetAssociationsMixinOptions = {
      ...options,
      scope: false,
      attributes: [this.target.primaryKeyAttribute],
      raw: true,
      // TODO: current WhereOptions typings do not allow having 'WhereOptions' inside another 'WhereOptions'
      // @ts-expect-error
      where: {
        [Op.and]: [
          where,
          options.where,
        ],
      },
    };

    const associatedObjects = await this.get(sourceInstance, findOptions);

    return associatedObjects.length === targetInstances.length;
  }

  /**
   * Set the associated models by passing an array of persisted instances or their primary keys. Everything that is not in the passed array will be un-associated
   *
   * @param sourceInstance source instance to associate new instances with
   * @param rawTargetInstances An array of persisted instances or primary key of instances to associate with this. Pass `null` or `undefined` to remove all associations.
   * @param options Options passed to `target.findAll` and `update`.
   */
  async set(
    sourceInstance: S,
    rawTargetInstances: AllowArray<T | CreationAttributes<T>>,
    options?: HasManySetAssociationsMixinOptions,
  ) {
    const targetInstances = rawTargetInstances === null ? [] : this.toInstanceArray(rawTargetInstances);

    const oldAssociations = await this.get(sourceInstance, { ...options, scope: false, raw: true });
    const promises: Array<Promise<any>> = [];
    const obsoleteAssociations = oldAssociations.filter(old => {
      return !targetInstances.some(obj => {
        return obj.get(this.target.primaryKeyAttribute) === old.get(this.target.primaryKeyAttribute);
      });
    });

    const unassociatedObjects = targetInstances.filter(obj => {
      return !oldAssociations.some(old => {
        return obj.get(this.target.primaryKeyAttribute) === old.get(this.target.primaryKeyAttribute);
      });
    });

    if (obsoleteAssociations.length > 0) {
      const update = {
        [this.foreignKey]: null,
      };

      const updateWhere = {
        [this.target.primaryKeyAttribute]: obsoleteAssociations
          .map(associatedObject => associatedObject.get(this.target.primaryKeyAttribute)),
      };

      promises.push(this.target.unscoped().update(
        update,
        {
          ...options,
          where: updateWhere,
        },
      ));
    }

    if (unassociatedObjects.length > 0) {
      const update = {
        [this.foreignKey]: sourceInstance.get(this.sourceKey),
        // FIXME: scopes should be combined using AND instance of overwriting.
        ...this.scope,
      };

      const updateWhere = {
        [this.target.primaryKeyAttribute]: unassociatedObjects.map(unassociatedObject => {
          return unassociatedObject.get(this.target.primaryKeyAttribute);
        }),
      };

      promises.push(this.target.unscoped().update(
        update,
        {
          ...options,
          where: updateWhere,
        },
      ));
    }

    await Promise.all(promises);

    return sourceInstance;
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
    rawTargetInstances: AllowArray<T | CreationAttributes<T>>,
    options: HasManyAddAssociationsMixinOptions = {},
  ) {
    if (!rawTargetInstances) {
      return sourceInstance;
    }

    const targetInstances = this.toInstanceArray(rawTargetInstances);

    const update = {
      [this.foreignKey]: sourceInstance.get(this.sourceKey),
      ...this.scope,
    };

    const where = {
      [this.target.primaryKeyAttribute]: targetInstances.map(unassociatedObject => {
        return unassociatedObject.get(this.target.primaryKeyAttribute);
      }),
    };

    await this.target.unscoped().update(update, { ...options, where });

    return sourceInstance;
  }

  /**
   * Un-associate one or several target rows.
   *
   * @param sourceInstance instance to un associate instances with
   * @param rawTargetInstances Can be an Instance or its primary key, or a mixed array of instances and primary keys
   * @param options Options passed to `target.update`
   */
  async remove(
    sourceInstance: S,
    rawTargetInstances: AllowArray<T | CreationAttributes<T>>,
    options: HasManyRemoveAssociationsMixinOptions = {},
  ) {
    const update = {
      [this.foreignKey]: null,
    };

    const targetInstances = this.toInstanceArray(rawTargetInstances);

    const where = {
      [this.foreignKey]: sourceInstance.get(this.sourceKey),
      [this.target.primaryKeyAttribute]: targetInstances.map(targetInstance => {
        return targetInstance.get(this.target.primaryKeyAttribute);
      }),
    };

    await this.target.unscoped().update(update, { ...options, where });

    return sourceInstance;
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
    options: HasManyCreateAssociationMixinOptions | HasManyCreateAssociationMixinOptions['fields'] = {},
  ) {
    if (Array.isArray(options)) {
      options = {
        fields: options,
      };
    }

    if (this.scope) {
      for (const attribute of Object.keys(this.scope)) {
        // TODO: fix the typing of {@link AssociationScope}
        // @ts-expect-error
        values[attribute] = this.scope[attribute];
        if (options.fields) {
          options.fields.push(attribute);
        }
      }
    }

    values[this.foreignKey] = sourceInstance.get(this.sourceKey);
    if (options.fields) {
      options.fields.push(this.foreignKey);
    }

    return this.target.create(values, options);
  }
}

/**
 * Options provided when associating models with hasMany relationship
 */
export interface HasManyOptions<Source extends Model> extends ManyToManyOptions {

  /**
   * The name of the field to use as the key for the association in the source table. Defaults to the primary
   * key of the source table
   */
  sourceKey?: AttributeNames<Source>;

  /**
   * A string or a data type to represent the identifier in the table
   */
  keyType?: DataType;
}

/**
 * The options for the getAssociations mixin of the hasMany association.
 *
 * Can provide an optional where clause to limit the associated models through {@link HasManyGetAssociationsMixinOptions.where}.
 *
 * @see HasManyGetAssociationsMixin
 */
export interface HasManyGetAssociationsMixinOptions extends FindOptions<any> {
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
 * ```js
 *
 * User.hasMany(Role);
 *
 * interface UserInstance extends Sequelize.Instance<UserInstance, UserAttributes>, UserAttributes {
 *  getRoles: Sequelize.HasManyGetAssociationsMixin<RoleInstance>;
 *  // setRoles...
 *  // addRoles...
 *  // addRole...
 *  // createRole...
 *  // removeRole...
 *  // removeRoles...
 *  // hasRole...
 *  // hasRoles...
 *  // countRoles...
 * }
 * ```
 *
 * @see https://sequelize.org/master/class/lib/associations/has-many.js~HasMany.html
 * @see Instance
 */
export type HasManyGetAssociationsMixin<TModel> = (options?: HasManyGetAssociationsMixinOptions) => Promise<TModel[]>;

/**
 * The options for the setAssociations mixin of the hasMany association.
 *
 * @see HasManySetAssociationsMixin
 */
export interface HasManySetAssociationsMixinOptions extends FindOptions<any>, InstanceUpdateOptions<any> {}

/**
 * The setAssociations mixin applied to models with hasMany.
 * An example of usage is as follows:
 *
 * ```js
 *
 * User.hasMany(Role);
 *
 * interface UserInstance extends Sequelize.Instance<UserInstance, UserAttributes>, UserAttributes {
 *  // getRoles...
 *  setRoles: Sequelize.HasManySetAssociationsMixin<RoleInstance, RoleId>;
 *  // addRoles...
 *  // addRole...
 *  // createRole...
 *  // removeRole...
 *  // removeRoles...
 *  // hasRole...
 *  // hasRoles...
 *  // countRoles...
 * }
 * ```
 *
 * @see https://sequelize.org/master/class/lib/associations/has-many.js~HasMany.html
 * @see Instance
 */
export type HasManySetAssociationsMixin<TModel, TModelPrimaryKey> = (
  newAssociations?: Array<TModel | TModelPrimaryKey>,
  options?: HasManySetAssociationsMixinOptions
) => Promise<void>;

/**
 * The options for the addAssociations mixin of the hasMany association.
 *
 * @see HasManyAddAssociationsMixin
 */
export interface HasManyAddAssociationsMixinOptions extends InstanceUpdateOptions<any> {}

/**
 * The addAssociations mixin applied to models with hasMany.
 * An example of usage is as follows:
 *
 * ```js
 *
 * User.hasMany(Role);
 *
 * interface UserInstance extends Sequelize.Instance<UserInstance, UserAttributes>, UserAttributes {
 *  // getRoles...
 *  // setRoles...
 *  addRoles: Sequelize.HasManyAddAssociationsMixin<RoleInstance, RoleId>;
 *  // addRole...
 *  // createRole...
 *  // removeRole...
 *  // removeRoles...
 *  // hasRole...
 *  // hasRoles...
 *  // countRoles...
 * }
 * ```
 *
 * @see https://sequelize.org/master/class/lib/associations/has-many.js~HasMany.html
 * @see Instance
 */
export type HasManyAddAssociationsMixin<TModel, TModelPrimaryKey> = (
  newAssociations?: Array<TModel | TModelPrimaryKey>,
  options?: HasManyAddAssociationsMixinOptions
) => Promise<void>;

/**
 * The options for the addAssociation mixin of the hasMany association.
 *
 * @see HasManyAddAssociationMixin
 */
export interface HasManyAddAssociationMixinOptions extends HasManyAddAssociationsMixinOptions {}

/**
 * The addAssociation mixin applied to models with hasMany.
 * An example of usage is as follows:
 *
 * ```js
 *
 * User.hasMany(Role);
 *
 * interface UserInstance extends Sequelize.Instance<UserInstance, UserAttributes>, UserAttributes {
 *  // getRoles...
 *  // setRoles...
 *  // addRoles...
 *  addRole: Sequelize.HasManyAddAssociationMixin<RoleInstance, RoleId>;
 *  // createRole...
 *  // removeRole...
 *  // removeRoles...
 *  // hasRole...
 *  // hasRoles...
 *  // countRoles...
 * }
 * ```
 *
 * @see https://sequelize.org/master/class/lib/associations/has-many.js~HasMany.html
 * @see Instance
 */
export type HasManyAddAssociationMixin<TModel, TModelPrimaryKey> = (
  newAssociation?: TModel | TModelPrimaryKey,
  options?: HasManyAddAssociationMixinOptions
) => Promise<void>;

/**
 * The options for the createAssociation mixin of the hasMany association.
 *
 * @see HasManyCreateAssociationMixin
 */
export interface HasManyCreateAssociationMixinOptions extends CreateOptions<any> {}

/**
 * The createAssociation mixin applied to models with hasMany.
 * An example of usage is as follows:
 *
 * ```js
 *
 * User.hasMany(Role);
 *
 * interface UserInstance extends Sequelize.Instance<UserInstance, UserAttributes>, UserAttributes {
 *  // getRoles...
 *  // setRoles...
 *  // addRoles...
 *  // addRole...
 *  createRole: Sequelize.HasManyCreateAssociationMixin<RoleAttributes>;
 *  // removeRole...
 *  // removeRoles...
 *  // hasRole...
 *  // hasRoles...
 *  // countRoles...
 * }
 * ```
 *
 * @see https://sequelize.org/master/class/lib/associations/has-many.js~HasMany.html
 * @see Instance
 */
export type HasManyCreateAssociationMixin<
  TModel extends Model,
  TForeignKey extends keyof CreationAttributes<TModel> = never,
  TScope extends keyof CreationAttributes<TModel> = never,
  > = (
  values?: Omit<CreationAttributes<TModel>, TForeignKey | TScope>,
  options?: HasManyCreateAssociationMixinOptions
) => Promise<TModel>;

/**
 * The options for the removeAssociation mixin of the hasMany association.
 *
 * @see HasManyRemoveAssociationMixin
 */
export interface HasManyRemoveAssociationMixinOptions extends HasManyRemoveAssociationsMixinOptions {}

/**
 * The removeAssociation mixin applied to models with hasMany.
 * An example of usage is as follows:
 *
 * ```js
 *
 * User.hasMany(Role);
 *
 * interface UserInstance extends Sequelize.Instance<UserInstance, UserAttributes>, UserAttributes {
 *  // getRoles...
 *  // setRoles...
 *  // addRoles...
 *  // addRole...
 *  // createRole...
 *  removeRole: Sequelize.HasManyRemoveAssociationMixin<RoleInstance, RoleId>;
 *  // removeRoles...
 *  // hasRole...
 *  // hasRoles...
 *  // countRoles...
 * }
 * ```
 *
 * @see https://sequelize.org/master/class/lib/associations/has-many.js~HasMany.html
 * @see Instance
 */
export type HasManyRemoveAssociationMixin<TModel, TModelPrimaryKey> = (
  oldAssociated?: TModel | TModelPrimaryKey,
  options?: HasManyRemoveAssociationMixinOptions
) => Promise<void>;

/**
 * The options for the removeAssociations mixin of the hasMany association.
 *
 * @see HasManyRemoveAssociationsMixin
 */
export interface HasManyRemoveAssociationsMixinOptions extends InstanceUpdateOptions<any> {}

/**
 * The removeAssociations mixin applied to models with hasMany.
 * An example of usage is as follows:
 *
 * ```js
 *
 * User.hasMany(Role);
 *
 * interface UserInstance extends Sequelize.Instance<UserInstance, UserAttributes>, UserAttributes {
 *  // getRoles...
 *  // setRoles...
 *  // addRoles...
 *  // addRole...
 *  // createRole...
 *  // removeRole...
 *  removeRoles: Sequelize.HasManyRemoveAssociationsMixin<RoleInstance, RoleId>;
 *  // hasRole...
 *  // hasRoles...
 *  // countRoles...
 * }
 * ```
 *
 * @see https://sequelize.org/master/class/lib/associations/has-many.js~HasMany.html
 * @see Instance
 */
export type HasManyRemoveAssociationsMixin<TModel, TModelPrimaryKey> = (
  oldAssociateds?: Array<TModel | TModelPrimaryKey>,
  options?: HasManyRemoveAssociationsMixinOptions
) => Promise<void>;

/**
 * The options for the hasAssociation mixin of the hasMany association.
 *
 * @see HasManyHasAssociationMixin
 */
export interface HasManyHasAssociationMixinOptions extends HasManyGetAssociationsMixinOptions {}

/**
 * The hasAssociation mixin applied to models with hasMany.
 * An example of usage is as follows:
 *
 * ```js
 *
 * User.hasMany(Role);
 *
 * interface UserInstance extends Sequelize.Instance<UserInstance, UserAttributes>, UserAttributes {
 *  // getRoles...
 *  // setRoles...
 *  // addRoles...
 *  // addRole...
 *  // createRole...
 *  // removeRole...
 *  // removeRoles...
 *  hasRole: Sequelize.HasManyHasAssociationMixin<RoleInstance, RoleId>;
 *  // hasRoles...
 *  // countRoles...
 * }
 * ```
 *
 * @see https://sequelize.org/master/class/lib/associations/has-many.js~HasMany.html
 * @see Instance
 */
export type HasManyHasAssociationMixin<TModel, TModelPrimaryKey> = (
  target: TModel | TModelPrimaryKey,
  options?: HasManyHasAssociationMixinOptions
) => Promise<boolean>;

/**
 * The options for the hasAssociations mixin of the hasMany association.
 *
 * @see HasManyHasAssociationsMixin
 */
export interface HasManyHasAssociationsMixinOptions extends HasManyGetAssociationsMixinOptions {}

/**
 * The removeAssociations mixin applied to models with hasMany.
 * An example of usage is as follows:
 *
 * ```js
 *
 * User.hasMany(Role);
 *
 * interface UserInstance extends Sequelize.Instance<UserInstance, UserAttributes>, UserAttributes {
 *  // getRoles...
 *  // setRoles...
 *  // addRoles...
 *  // addRole...
 *  // createRole...
 *  // removeRole...
 *  // removeRoles
 *  // hasRole...
 *  hasRoles: Sequelize.HasManyHasAssociationsMixin<RoleInstance, RoleId>;
 *  // countRoles...
 * }
 * ```
 *
 * @see https://sequelize.org/master/class/lib/associations/has-many.js~HasMany.html
 * @see Instance
 */
export type HasManyHasAssociationsMixin<TModel, TModelPrimaryKey> = (
  targets: Array<TModel | TModelPrimaryKey>,
  options?: HasManyHasAssociationsMixinOptions
) => Promise<boolean>;

/**
 * The options for the countAssociations mixin of the hasMany association.
 *
 * @see HasManyCountAssociationsMixin
 */
export interface HasManyCountAssociationsMixinOptions extends Transactionable, Filterable<any> {
  /**
   * Apply a scope on the related model, or remove its default scope by passing false.
   */
  scope?: string | boolean;
}

/**
 * The countAssociations mixin applied to models with hasMany.
 * An example of usage is as follows:
 *
 * ```js
 *
 * User.hasMany(Role);
 *
 * interface UserInstance extends Sequelize.Instance<UserInstance, UserAttributes>, UserAttributes {
 *  // getRoles...
 *  // setRoles...
 *  // addRoles...
 *  // addRole...
 *  // createRole...
 *  // removeRole...
 *  // removeRoles...
 *  // hasRole...
 *  // hasRoles...
 *  countRoles: Sequelize.HasManyCountAssociationsMixin;
 * }
 * ```
 *
 * @see https://sequelize.org/master/class/lib/associations/has-many.js~HasMany.html
 * @see Instance
 */
export type HasManyCountAssociationsMixin = (options?: HasManyCountAssociationsMixinOptions) => Promise<number>;
