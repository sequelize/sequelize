import { DataType } from '../data-types';
import { CreateOptions, CreationAttributes, FindOptions, Model, ModelCtor, SaveOptions } from '../model';
import { Association, AssociationOptions, SingleAssociationAccessors } from './base';

/**
 * Options provided when associating models with hasOne relationship
 */
export interface HasOneOptions extends AssociationOptions {

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

export class HasOne<S extends Model = Model, T extends Model = Model> extends Association<S, T> {
  public accessors: SingleAssociationAccessors;
  constructor(source: ModelCtor<S>, target: ModelCtor<T>, options: HasOneOptions);
}

/**
 * The options for the getAssociation mixin of the hasOne association.
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
