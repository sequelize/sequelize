import { DataType } from '../data-types';
import { CreateOptions, FindOptions, Model, ModelCtor, SaveOptions } from '../model';
import { Promise } from '../promise';
import { Association, AssociationOptions, SingleAssociationAccessors } from './base';

// type ModelCtor<M extends Model> = InstanceType<typeof M>;
/**
 * Options provided when associating models with belongsTo relationship
 *
 * @see Association class belongsTo method
 */
export interface BelongsToOptions extends AssociationOptions {
  /**
   * The name of the field to use as the key for the association in the target table. Defaults to the primary
   * key of the target table
   */
  targetKey?: string;

  /**
   * A string or a data type to represent the identifier in the table
   */
  keyType?: DataType;
}

export class BelongsTo<S extends Model = Model, T extends Model = Model> extends Association<S, T> {
  public accessors: SingleAssociationAccessors;
  constructor(source: ModelCtor<S>, target: ModelCtor<T>, options: BelongsToOptions);
}

/**
 * The options for the getAssociation mixin of the belongsTo association.
 * @see BelongsToGetAssociationMixin
 */
export interface BelongsToGetAssociationMixinOptions extends FindOptions {
  /**
   * Apply a scope on the related model, or remove its default scope by passing false.
   */
  scope?: string | string[] | boolean;
}

/**
 * The getAssociation mixin applied to models with belongsTo.
 * An example of usage is as follows:
 *
 * ```js
 *
 * User.belongsTo(Role);
 *
 * interface UserInstance extends Sequelize.Instance<UserInstance, UserAttrib>, UserAttrib {
 *  getRole: Sequelize.BelongsToGetAssociationMixin<RoleInstance>;
 *  // setRole...
 *  // createRole...
 * }
 * ```
 *
 * @see https://sequelize.org/master/class/lib/associations/belongs-to.js~BelongsTo.html
 * @see Instance
 */
export type BelongsToGetAssociationMixin<TModel> = (options?: BelongsToGetAssociationMixinOptions) => Promise<TModel>;

/**
 * The options for the setAssociation mixin of the belongsTo association.
 * @see BelongsToSetAssociationMixin
 */
export interface BelongsToSetAssociationMixinOptions extends SaveOptions {
  /**
   * Skip saving this after setting the foreign key if false.
   */
  save?: boolean;
}

/**
 * The setAssociation mixin applied to models with belongsTo.
 * An example of usage is as follows:
 *
 * ```js
 *
 * User.belongsTo(Role);
 *
 * interface UserInstance extends Sequelize.Instance<UserInstance, UserAttributes>, UserAttributes {
 *  // getRole...
 *  setRole: Sequelize.BelongsToSetAssociationMixin<RoleInstance, RoleId>;
 *  // createRole...
 * }
 * ```
 *
 * @see https://sequelize.org/master/class/lib/associations/belongs-to.js~BelongsTo.html
 * @see Instance
 */
export type BelongsToSetAssociationMixin<TModel, TPrimaryKey> = (
  newAssociation?: TModel | TPrimaryKey,
  options?: BelongsToSetAssociationMixinOptions
) => Promise<void>;

/**
 * The options for the createAssociation mixin of the belongsTo association.
 * @see BelongsToCreateAssociationMixin
 */
export interface BelongsToCreateAssociationMixinOptions extends CreateOptions, BelongsToSetAssociationMixinOptions {}

/**
 * The createAssociation mixin applied to models with belongsTo.
 * An example of usage is as follows:
 *
 * ```js
 *
 * User.belongsTo(Role);
 *
 * interface UserInstance extends Sequelize.Instance<UserInstance, UserAttributes>, UserAttributes {
 *  // getRole...
 *  // setRole...
 *  createRole: Sequelize.BelongsToCreateAssociationMixin<RoleAttributes>;
 * }
 * ```
 *
 * @see https://sequelize.org/master/class/lib/associations/belongs-to.js~BelongsTo.html
 * @see Instance
 */
export type BelongsToCreateAssociationMixin<TModel> = (
  values?: { [attribute: string]: unknown },
  options?: BelongsToCreateAssociationMixinOptions
) => Promise<TModel>;

export default BelongsTo;
