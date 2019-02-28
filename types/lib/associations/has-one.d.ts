import { DataType } from '../data-types';
import { CreateOptions, FindOptions, Model, SaveOptions } from '../model';
import { Promise } from '../promise';
import { Association, AssociationOptions, SingleAssociationAccessors } from './base';

/**
 * Options provided when associating models with hasOne relationship
 */
export interface HasOneOptions extends AssociationOptions {
  /**
   * A string or a data type to represent the identifier in the table
   */
  keyType?: DataType;
}

export class HasOne extends Association {
  public accessors: SingleAssociationAccessors;
  constructor(source: typeof Model, target: typeof Model, options: HasOneOptions);
}

/**
 * The options for the getAssociation mixin of the hasOne association.
 * @see HasOneGetAssociationMixin
 */
export interface HasOneGetAssociationMixinOptions extends FindOptions {
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
 * @see http://docs.sequelizejs.com/en/latest/api/associations/has-one/
 * @see Instance
 */
export type HasOneGetAssociationMixin<TModel> = (options?: HasOneGetAssociationMixinOptions) => Promise<TModel>;

/**
 * The options for the setAssociation mixin of the hasOne association.
 * @see HasOneSetAssociationMixin
 */
export interface HasOneSetAssociationMixinOptions extends HasOneGetAssociationMixinOptions, SaveOptions {
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
 * @see http://docs.sequelizejs.com/en/latest/api/associations/has-one/
 * @see Instance
 */
export type HasOneSetAssociationMixin<TModel, TModelPrimaryKey> = (
  newAssociation?: TModel | TModelPrimaryKey,
  options?: HasOneSetAssociationMixinOptions
) => Promise<void>;

/**
 * The options for the createAssociation mixin of the hasOne association.
 * @see HasOneCreateAssociationMixin
 */
export interface HasOneCreateAssociationMixinOptions extends HasOneSetAssociationMixinOptions, CreateOptions {}

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
 * @see http://docs.sequelizejs.com/en/latest/api/associations/has-one/
 * @see Instance
 */
export type HasOneCreateAssociationMixin<TModel> = (
  values?: { [attribute: string]: unknown },
  options?: HasOneCreateAssociationMixinOptions
) => Promise<TModel>;
