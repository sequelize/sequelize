import { DataType } from '../data-types';
import {
  CreateOptions,
  Filterable,
  FindOptions,
  InstanceUpdateOptions,
  Model,
  Transactionable,
  WhereOptions,
} from '../model';
import { Promise } from '../promise';
import { Transaction } from '../transaction';
import { Association, ManyToManyOptions, MultiAssociationAccessors } from './base';

/**
 * Options provided when associating models with hasMany relationship
 */
export interface HasManyOptions extends ManyToManyOptions {
  /**
   * A string or a data type to represent the identifier in the table
   */
  keyType?: DataType;
}

export class HasMany extends Association {
  public accessors: MultiAssociationAccessors;
  constructor(source: typeof Model, target: typeof Model, options: HasManyOptions);
}

/**
 * The options for the getAssociations mixin of the hasMany association.
 * @see HasManyGetAssociationsMixin
 */
export interface HasManyGetAssociationsMixinOptions extends FindOptions {
  /**
   * Apply a scope on the related model, or remove its default scope by passing false.
   */
  scope?: string | string[] | boolean;
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
 * @see http://docs.sequelizejs.com/en/latest/api/associations/has-many/
 * @see Instance
 */
export type HasManyGetAssociationsMixin<TModel> = (options?: HasManyGetAssociationsMixinOptions) => Promise<TModel[]>;

/**
 * The options for the setAssociations mixin of the hasMany association.
 * @see HasManySetAssociationsMixin
 */
export interface HasManySetAssociationsMixinOptions extends FindOptions, InstanceUpdateOptions {}

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
 * @see http://docs.sequelizejs.com/en/latest/api/associations/has-many/
 * @see Instance
 */
export type HasManySetAssociationsMixin<TModel, TModelPrimaryKey> = (
  newAssociations?: (TModel | TModelPrimaryKey)[],
  options?: HasManySetAssociationsMixinOptions
) => Promise<void>;

/**
 * The options for the addAssociations mixin of the hasMany association.
 * @see HasManyAddAssociationsMixin
 */
export interface HasManyAddAssociationsMixinOptions extends InstanceUpdateOptions {}

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
 * @see http://docs.sequelizejs.com/en/latest/api/associations/has-many/
 * @see Instance
 */
export type HasManyAddAssociationsMixin<TModel, TModelPrimaryKey> = (
  newAssociations?: (TModel | TModelPrimaryKey)[],
  options?: HasManyAddAssociationsMixinOptions
) => Promise<void>;

/**
 * The options for the addAssociation mixin of the hasMany association.
 * @see HasManyAddAssociationMixin
 */
export interface HasManyAddAssociationMixinOptions extends InstanceUpdateOptions {}

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
 * @see http://docs.sequelizejs.com/en/latest/api/associations/has-many/
 * @see Instance
 */
export type HasManyAddAssociationMixin<TModel, TModelPrimaryKey> = (
  newAssociation?: TModel | TModelPrimaryKey,
  options?: HasManyAddAssociationMixinOptions
) => Promise<void>;

/**
 * The options for the createAssociation mixin of the hasMany association.
 * @see HasManyCreateAssociationMixin
 */
export interface HasManyCreateAssociationMixinOptions extends CreateOptions {}

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
 * @see http://docs.sequelizejs.com/en/latest/api/associations/has-many/
 * @see Instance
 */
export type HasManyCreateAssociationMixin<TModel> = (
  values?: { [attribute: string]: unknown },
  options?: HasManyCreateAssociationMixinOptions
) => Promise<TModel>;

/**
 * The options for the removeAssociation mixin of the hasMany association.
 * @see HasManyRemoveAssociationMixin
 */
export interface HasManyRemoveAssociationMixinOptions extends InstanceUpdateOptions {}

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
 * @see http://docs.sequelizejs.com/en/latest/api/associations/has-many/
 * @see Instance
 */
export type HasManyRemoveAssociationMixin<TModel, TModelPrimaryKey> = (
  oldAssociated?: TModel | TModelPrimaryKey,
  options?: HasManyRemoveAssociationMixinOptions
) => Promise<void>;

/**
 * The options for the removeAssociations mixin of the hasMany association.
 * @see HasManyRemoveAssociationsMixin
 */
export interface HasManyRemoveAssociationsMixinOptions extends InstanceUpdateOptions {}

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
 * @see http://docs.sequelizejs.com/en/latest/api/associations/has-many/
 * @see Instance
 */
export type HasManyRemoveAssociationsMixin<TModel, TModelPrimaryKey> = (
  oldAssociateds?: (TModel | TModelPrimaryKey)[],
  options?: HasManyRemoveAssociationsMixinOptions
) => Promise<void>;

/**
 * The options for the hasAssociation mixin of the hasMany association.
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
 * @see http://docs.sequelizejs.com/en/latest/api/associations/has-many/
 * @see Instance
 */
export type HasManyHasAssociationMixin<TModel, TModelPrimaryKey> = (
  target: TModel | TModelPrimaryKey,
  options?: HasManyHasAssociationMixinOptions
) => Promise<boolean>;

/**
 * The options for the hasAssociations mixin of the hasMany association.
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
 * @see http://docs.sequelizejs.com/en/latest/api/associations/has-many/
 * @see Instance
 */
export type HasManyHasAssociationsMixin<TModel, TModelPrimaryKey> = (
  targets: (TModel | TModelPrimaryKey)[],
  options?: HasManyHasAssociationsMixinOptions
) => Promise<boolean>;

/**
 * The options for the countAssociations mixin of the hasMany association.
 * @see HasManyCountAssociationsMixin
 */
export interface HasManyCountAssociationsMixinOptions extends Transactionable, Filterable {
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
 * @see http://docs.sequelizejs.com/en/latest/api/associations/has-many/
 * @see Instance
 */
export type HasManyCountAssociationsMixin = (options?: HasManyCountAssociationsMixinOptions) => Promise<number>;
