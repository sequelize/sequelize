import { DataType } from '../data-types';
import {
  CreateOptions,
  Filterable,
  FindOptions,
  InstanceUpdateOptions,
  Model,
  ModelCtor,
  Transactionable,
} from '../model';
import { Association, ManyToManyOptions, MultiAssociationAccessors } from './base';

/**
 * Options provided when associating models with hasMany relationship
 */
export interface HasManyOptions extends ManyToManyOptions {

  /**
   * The name of the field to use as the key for the association in the source table. Defaults to the primary
   * key of the source table
   */
  sourceKey?: string;

  /**
   * A string or a data type to represent the identifier in the table
   */
  keyType?: DataType;
}

export class HasMany<S extends Model = Model, T extends Model = Model> extends Association<S, T> {
  public accessors: MultiAssociationAccessors;
  constructor(source: ModelCtor<S>, target: ModelCtor<T>, options: HasManyOptions);
}

/**
 * The options for the getAssociations mixin of the hasMany association.
 * @see HasManyGetAssociationsMixin
 */
export interface HasManyGetAssociationsMixinOptions extends FindOptions<any> {
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
 * @see https://sequelize.org/master/class/lib/associations/has-many.js~HasMany.html
 * @see Instance
 */
export type HasManyGetAssociationsMixin<TModel> = (options?: HasManyGetAssociationsMixinOptions) => Promise<TModel[]>;

/**
 * The options for the setAssociations mixin of the hasMany association.
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
  newAssociations?: (TModel | TModelPrimaryKey)[],
  options?: HasManySetAssociationsMixinOptions
) => Promise<void>;

/**
 * The options for the addAssociations mixin of the hasMany association.
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
  newAssociations?: (TModel | TModelPrimaryKey)[],
  options?: HasManyAddAssociationsMixinOptions
) => Promise<void>;

/**
 * The options for the addAssociation mixin of the hasMany association.
 * @see HasManyAddAssociationMixin
 */
export interface HasManyAddAssociationMixinOptions extends InstanceUpdateOptions<any> {}

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
export type HasManyCreateAssociationMixin<TModel extends Model> = (
  values?: Model['_creationAttributes'],
  options?: HasManyCreateAssociationMixinOptions
) => Promise<TModel>;

/**
 * The options for the removeAssociation mixin of the hasMany association.
 * @see HasManyRemoveAssociationMixin
 */
export interface HasManyRemoveAssociationMixinOptions extends InstanceUpdateOptions<any> {}

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
 * @see https://sequelize.org/master/class/lib/associations/has-many.js~HasMany.html
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
 * @see https://sequelize.org/master/class/lib/associations/has-many.js~HasMany.html
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
