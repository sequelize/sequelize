import upperFirst from 'lodash/upperFirst';
import type { DataType } from '../data-types.js';
import type { CreateOptions, CreationAttributes, FindOptions, SaveOptions, Model, ModelStatic, Attributes } from '../model';
import { Op } from '../operators';
import * as Utils from '../utils';
import type { AssociationOptions } from './base';
// eslint-disable-next-line import/order -- error due to require('./helpers')
import { Association } from './base';

const Helpers = require('./helpers');

/**
 * One-to-one association
 *
 * In the API reference below, add the name of the association to the method, e.g. for `User.hasOne(Project)` the getter will be `user.getProject()`.
 * This is almost the same as `belongsTo` with one exception - The foreign key will be defined on the target model.
 *
 * @see {@link Model.hasOne}
 */
export class HasOne<S extends Model = Model, T extends Model = Model> extends Association<S, T, HasOneOptions<S>> {
  associationType = 'HasOne';
  isSingleAssociation = true;

  readonly accessors: {
    get: string,
    set: string,
    create: string,
  };

  constructor(source: ModelStatic<S>, target: ModelStatic<T>, options: HasOneOptions<S>) {
    super(source, target, options);

    if (
      this.options.sourceKey
      && !this.source.getAttributes()[this.options.sourceKey]
    ) {
      throw new Error(`Unknown attribute "${this.options.sourceKey}" passed as sourceKey, define this attribute on model "${this.source.name}" first`);
    }

    this.sourceKey = this.sourceKeyAttribute = this.options.sourceKey || this.source.primaryKeyAttribute;
    this.sourceKeyField = this.source.rawAttributes[this.sourceKey].field || this.sourceKey;
    this.sourceKeyIsPrimary = this.sourceKey === this.source.primaryKeyAttribute;

    this.associationAccessor = this.as;
    this.options.useHooks = options.useHooks;

    if (this.target.rawAttributes[this.foreignKey]) {
      this.identifierField = this.target.rawAttributes[this.foreignKey].field || this.foreignKey;
    }

    // Get singular name, trying to uppercase the first letter, unless the model forbids it
    const singular = upperFirst(this.options.name.singular);

    this.accessors = {
      get: `get${singular}`,
      set: `set${singular}`,
      create: `create${singular}`,
    };
  }

  // the id is in the target table
  _injectAttributes() {
    const newAttributes = {
      [this.foreignKey]: {
        type: this.options.keyType || this.source.rawAttributes[this.sourceKey].type,
        allowNull: true,
        ...this.foreignKeyAttribute,
      },
    };

    if (this.options.constraints !== false) {
      const target = this.target.rawAttributes[this.foreignKey] || newAttributes[this.foreignKey];
      this.options.onDelete = this.options.onDelete || (target.allowNull ? 'SET NULL' : 'CASCADE');
      this.options.onUpdate = this.options.onUpdate || 'CASCADE';
    }

    Helpers.addForeignKeyConstraints(newAttributes[this.foreignKey], this.source, this.target, this.options, this.sourceKeyField);
    Utils.mergeDefaults(this.target.rawAttributes, newAttributes);

    this.target.refreshAttributes();

    this.identifierField = this.target.rawAttributes[this.foreignKey].field || this.foreignKey;

    Helpers.checkNamingCollision(this);

    return this;
  }

  mixin(obj) {
    const methods = ['get', 'set', 'create'];

    Helpers.mixinMethods(this, obj, methods);
  }

  /**
   * Get the associated instance.
   *
   * @param instances source instances
   * @param         [options] find options
   * @param [options.scope] Apply a scope on the related model, or remove its default scope by passing false
   * @param [options.schema] Apply a schema on the related model
   *
   * @see
   * {@link Model.findOne} for a full explanation of options
   *
   * @returns
   */
  async get(instances, options) {
    const where = {};

    let Target = this.target;
    let instance;

    options = Utils.cloneDeep(options);

    if (Object.prototype.hasOwnProperty.call(options, 'scope')) {
      if (!options.scope) {
        Target = Target.unscoped();
      } else {
        Target = Target.scope(options.scope);
      }
    }

    if (Object.prototype.hasOwnProperty.call(options, 'schema')) {
      Target = Target.schema(options.schema, options.schemaDelimiter);
    }

    if (!Array.isArray(instances)) {
      instance = instances;
      instances = undefined;
    }

    if (instances) {
      where[this.foreignKey] = {
        [Op.in]: instances.map(_instance => _instance.get(this.sourceKey)),
      };
    } else {
      where[this.foreignKey] = instance.get(this.sourceKey);
    }

    if (this.scope) {
      Object.assign(where, this.scope);
    }

    options.where = options.where
      ? { [Op.and]: [where, options.where] }
      : where;

    if (instances) {
      const results = await Target.findAll(options);
      const result = {};
      for (const _instance of instances) {
        result[_instance.get(this.sourceKey, { raw: true })] = null;
      }

      for (const _instance of results) {
        result[_instance.get(this.foreignKey, { raw: true })] = _instance;
      }

      return result;
    }

    return Target.findOne(options);
  }

  /**
   * Set the associated model.
   *
   * @param sourceInstance the source instance
   * @param [associatedInstance] An persisted instance or the primary key of an instance to associate with this. Pass `null` or `undefined` to remove the association.
   * @param [options] Options passed to getAssociation and `target.save`
   *
   * @returns
   */
  async set(sourceInstance, associatedInstance, options) {
    options = { ...options, scope: false };

    const oldInstance = await sourceInstance[this.accessors.get](options);
    // TODO Use equals method once #5605 is resolved
    const alreadyAssociated = oldInstance && associatedInstance && this.target.primaryKeyAttributes.every(attribute => oldInstance.get(attribute, { raw: true }) === (associatedInstance.get ? associatedInstance.get(attribute, { raw: true }) : associatedInstance));

    if (oldInstance && !alreadyAssociated) {
      oldInstance[this.foreignKey] = null;

      await oldInstance.save({
        ...options,
        fields: [this.foreignKey],
        allowNull: [this.foreignKey],
        association: true,
      });
    }

    if (associatedInstance && !alreadyAssociated) {
      if (!(associatedInstance instanceof this.target)) {
        const tmpInstance = {};
        tmpInstance[this.target.primaryKeyAttribute] = associatedInstance;
        associatedInstance = this.target.build(tmpInstance, {
          isNewRecord: false,
        });
      }

      Object.assign(associatedInstance, this.scope);
      associatedInstance.set(this.foreignKey, sourceInstance.get(this.sourceKeyAttribute));

      return associatedInstance.save(options);
    }

    return null;
  }

  /**
   * Create a new instance of the associated model and associate it with this.
   *
   * @param sourceInstance the source instance
   * @param [values={}] values to create associated model instance with
   * @param [options] Options passed to `target.create` and setAssociation.
   *
   * @see
   * {@link Model#create} for a full explanation of options
   *
   * @returns The created target model
   */
  async create(sourceInstance, values, options) {
    values = values || {};
    options = options || {};

    if (this.scope) {
      for (const attribute of Object.keys(this.scope)) {
        values[attribute] = this.scope[attribute];
        if (options.fields) {
          options.fields.push(attribute);
        }
      }
    }

    values[this.foreignKey] = sourceInstance.get(this.sourceKeyAttribute);
    if (options.fields) {
      options.fields.push(this.foreignKey);
    }

    return this.target.create(values, options);
  }

  verifyAssociationAlias(alias) {
    if (typeof alias === 'string') {
      return this.as === alias;
    }

    if (alias && alias.singular) {
      return this.as === alias.singular;
    }

    return !this.isAliased;
  }
}

/**
 * Options provided when associating models with hasOne relationship
 */
export interface HasOneOptions<Source extends Model> extends AssociationOptions {

  /**
   * The name of the field to use as the key for the association in the source table. Defaults to the primary
   * key of the source table.
   *
   * This is the attribute the foreign key will target. Not to be confused with {@link AssociationOptions.foreignKey}.
   */
  sourceKey?: keyof Attributes<Source>;

  /**
   * A string or a data type to represent the identifier in the table
   */
  keyType?: DataType;
}

/**
 * The options for the getAssociation mixin of the hasOne association.
 *
 * @see HasOneGetAssociationMixin
 */
export interface HasOneGetAssociationMixinOptions extends FindOptions<any> {
  /**
   * Apply a scope on the related model, or remove its default scope by passing false.
   */
  scope?: string | string[] | boolean;
}

/**
 * The getAssociation mixin applied to models with hasOne.
 * An example of usage is as follows:
 *
 * ```js
 *
 * User.hasOne(Role);
 *
 * interface UserInstance extends Sequelize.Instance<UserInstance, UserAttrib>, UserAttrib {
 *  getRole: Sequelize.HasOneGetAssociationMixin<RoleInstance>;
 *  // setRole...
 *  // createRole...
 * }
 * ```
 *
 * @see https://sequelize.org/master/class/lib/associations/has-one.js~HasOne.html
 * @see Instance
 */
export type HasOneGetAssociationMixin<TModel> = (options?: HasOneGetAssociationMixinOptions) => Promise<TModel>;

/**
 * The options for the setAssociation mixin of the hasOne association.
 *
 * @see HasOneSetAssociationMixin
 */
export interface HasOneSetAssociationMixinOptions extends HasOneGetAssociationMixinOptions, SaveOptions<any> {
  /**
   * Skip saving this after setting the foreign key if false.
   */
  save?: boolean;
}

/**
 * The setAssociation mixin applied to models with hasOne.
 * An example of usage is as follows:
 *
 * ```js
 *
 * User.hasOne(Role);
 *
 * interface UserInstance extends Sequelize.Instance<UserInstance, UserAttributes>, UserAttributes {
 *  // getRole...
 *  setRole: Sequelize.HasOneSetAssociationMixin<RoleInstance, RoleId>;
 *  // createRole...
 * }
 * ```
 *
 * @see https://sequelize.org/master/class/lib/associations/has-one.js~HasOne.html
 * @see Instance
 */
export type HasOneSetAssociationMixin<TModel, TModelPrimaryKey> = (
  newAssociation?: TModel | TModelPrimaryKey,
  options?: HasOneSetAssociationMixinOptions
) => Promise<void>;

/**
 * The options for the createAssociation mixin of the hasOne association.
 *
 * @see HasOneCreateAssociationMixin
 */
export interface HasOneCreateAssociationMixinOptions extends HasOneSetAssociationMixinOptions, CreateOptions<any> {}

/**
 * The createAssociation mixin applied to models with hasOne.
 * An example of usage is as follows:
 *
 * ```js
 *
 * User.hasOne(Role);
 *
 * interface UserInstance extends Sequelize.Instance<UserInstance, UserAttributes>, UserAttributes {
 *  // getRole...
 *  // setRole...
 *  createRole: Sequelize.HasOneCreateAssociationMixin<RoleAttributes>;
 * }
 * ```
 *
 * @see https://sequelize.org/master/class/lib/associations/has-one.js~HasOne.html
 * @see Instance
 */
export type HasOneCreateAssociationMixin<TModel extends Model> = (
  values?: CreationAttributes<TModel>,
  options?: HasOneCreateAssociationMixinOptions
) => Promise<TModel>;
