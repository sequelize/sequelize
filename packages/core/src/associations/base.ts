import type { AllowIterable, Nullish, PartialBy } from '@sequelize/utils';
import { isIterable } from '@sequelize/utils';
import isObject from 'lodash/isObject.js';
import type { AttributeNames, AttributeOptions, Hookable, Model, ModelStatic } from '../model';
import { cloneDeep } from '../utils/object.js';
import type { NormalizeBaseAssociationOptions } from './helpers';
import { AssociationSecret } from './helpers';

/**
 * Creating associations in sequelize is done by calling one of the belongsTo / hasOne / hasMany / belongsToMany functions on a model (the source), and providing another model as the first argument to the function (the target).
 *
 * * hasOne - adds a foreign key to the target and singular association mixins to the source.
 * * belongsTo - add a foreign key and singular association mixins to the source.
 * * hasMany - adds a foreign key to target and plural association mixins to the source.
 * * belongsToMany - creates an N:M association with a join table and adds plural association mixins to the source. The junction table is created with sourceId and targetId.
 *
 * Creating an association will add a foreign key constraint to the attributes. All associations use `CASCADE` on update and `SET NULL` on delete, except for n:m, which also uses `CASCADE` on delete.
 *
 * When creating associations, you can provide an alias, via the `as` option. This is useful if the same model is associated twice, or you want your association to be called something other than the name of the target model.
 *
 * As an example, consider the case where users have many pictures, one of which is their profile picture. All pictures have a `userId`, but in addition the user model also has a `profilePictureId`, to be able to easily load the user's profile picture.
 *
 * ```js
 * User.hasMany(Picture)
 * User.belongsTo(Picture, { as: 'ProfilePicture', foreignKeyConstraints: false })
 *
 * user.getPictures() // gets you all pictures
 * user.getProfilePicture() // gets you only the profile picture
 *
 * User.findAll({
 *   where: ...,
 *   include: [
 *     { model: Picture }, // load all pictures
 *     { model: Picture, as: 'ProfilePicture' }, // load the profile picture.
 *     // Notice that the spelling must be the exact same as the one in the association
 *   ]
 * })
 * ```
 * To get full control over the foreign key column added by sequelize, you can use the `foreignKey` option. It can either be a string, that specifies the name, or and object type definition,
 * equivalent to those passed to `sequelize.define`.
 *
 * ```js
 * User.hasMany(Picture, { foreignKey: 'uid' })
 * ```
 *
 * The foreign key column in Picture will now be called `uid` instead of the default `userId`.
 *
 * ```js
 * User.hasMany(Picture, {
 *   foreignKey: {
 *     name: 'uid',
 *     allowNull: false
 *   }
 * })
 * ```
 *
 * This specifies that the `uid` column cannot be null. In most cases this will already be covered by the foreign key constraints, which sequelize creates automatically, but can be useful in case where the foreign keys are disabled, e.g. due to circular references (see `constraints: false` below).
 *
 * When fetching associated models, you can limit your query to only load some models. These queries are written in the same way as queries to `find`/`findAll`. To only get pictures in JPG, you can do:
 *
 * ```js
 * user.getPictures({
 *   where: {
 *     format: 'jpg'
 *   }
 * })
 * ```
 *
 * There are several ways to update and add new associations. Continuing with our example of users and pictures:
 * ```js
 * user.addPicture(p) // Add a single picture
 * user.setPictures([p1, p2]) // Associate user with ONLY these two picture, all other associations will be deleted
 * user.addPictures([p1, p2]) // Associate user with these two pictures, but don't touch any current associations
 * ```
 *
 * You don't have to pass in a complete object to the association functions, if your associated model has a single primary key:
 *
 * ```js
 * user.addPicture(req.query.pid) // Here pid is just an integer, representing the primary key of the picture
 * ```
 *
 * In the example above we have specified that a user belongs to his profile picture. Conceptually, this might not make sense, but since we want to add the foreign key to the user model this is the way to do it.
 *
 * Note how we also specified `foreignKeyConstraints: false` for profile picture. This is because we add a foreign key from user to picture (profilePictureId), and from picture to user (userId). If we were to add foreign keys to both, it would create a cyclic dependency, and sequelize would not know which table to create first, since user depends on picture, and picture depends on user. These kinds of problems are detected by sequelize before the models are synced to the database, and you will get an error along the lines of `Error: Cyclic dependency found. 'users' is dependent of itself`. If you encounter this, you should either disable some constraints, or rethink your associations completely.
 */
export abstract class Association<
  S extends Model = Model,
  T extends Model = Model,
  ForeignKey extends string = string,
  Opts extends NormalizedAssociationOptions<ForeignKey> = NormalizedAssociationOptions<ForeignKey>,
> {
  source: ModelStatic<S>;
  target: ModelStatic<T>;
  isSelfAssociation: boolean;
  isAliased: boolean;

  readonly options: Opts;

  abstract accessors: Record<
    /* methodName in association */ string,
    /* method name in model */ string
  >;

  abstract foreignKey: ForeignKey;

  /**
   * A reference to the association that created this one.
   */
  readonly parentAssociation: Association | null;

  /**
   * Creating an associations can automatically create other associations.
   * This returns the initial association that caused the creation of the descendant associations.
   */
  // eslint-disable-next-line @typescript-eslint/prefer-return-this-type -- false positive
  get rootAssociation(): Association {
    if (this.parentAssociation) {
      return this.parentAssociation.rootAssociation;
    }

    return this;
  }

  /**
   * The type of the association. One of `HasMany`, `BelongsTo`, `HasOne`, `BelongsToMany`
   *
   * @type {string}
   */
  get associationType(): string {
    return this.constructor.name;
  }

  get isMultiAssociation(): boolean {
    return (this.constructor as typeof Association).isMultiAssociation;
  }

  /**
   * @deprecated negate {@link isMultiAssociation} instead
   */
  get isSingleAssociation(): boolean {
    return !this.isMultiAssociation;
  }

  static get isMultiAssociation(): boolean {
    return false;
  }

  constructor(
    secret: symbol,
    source: ModelStatic<S>,
    target: ModelStatic<T>,
    options: Opts,
    parent?: Association<any>,
  ) {
    if (secret !== AssociationSecret) {
      throw new Error(
        `Class ${this.constructor.name} cannot be instantiated directly due to it mutating the source model. Use one of the static methods on Model instead.`,
      );
    }

    this.source = source;
    this.target = target;
    this.parentAssociation = parent ?? null;

    this.isSelfAssociation =
      // @ts-expect-error -- TypeScript thinks ModelStatic & ModelStatic have no overlap.
      this.source === this.target;

    this.isAliased = Boolean(options?.as);

    this.options = cloneDeep(options) ?? {};

    source.modelDefinition.hooks.runSync('beforeDefinitionRefresh');
    source.associations[this.as] = this;
    source.modelDefinition.hooks.runSync('afterDefinitionRefresh');
  }

  /**
   * The identifier of the relation on the source model.
   */
  get as(): string {
    return this.options.as;
  }

  get name(): { singular: string; plural: string } {
    return this.options.name;
  }

  get scope(): AssociationScope | undefined {
    return this.options.scope;
  }

  [Symbol.for('nodejs.util.inspect.custom')]() {
    return this.as;
  }
}

/**
 * @private
 */
export abstract class MultiAssociation<
  S extends Model = Model,
  T extends Model = Model,
  ForeignKey extends string = string,
  TargetKey extends AttributeNames<T> = any,
  Opts extends NormalizedAssociationOptions<ForeignKey> = NormalizedAssociationOptions<ForeignKey>,
> extends Association<S, T, ForeignKey, Opts> {
  static get isMultiAssociation() {
    return true;
  }

  protected toInstanceOrPkArray(
    input: AllowIterable<T | Exclude<T[TargetKey], any[]>> | Nullish,
  ): Array<T | Exclude<T[TargetKey], any[]>> {
    if (input == null) {
      return [];
    }

    if (!isIterable(input) || !isObject(input)) {
      return [input];
    }

    return [...input];
  }

  /**
   * Normalize input
   *
   * @param input it may be array or single obj, instance or primary key
   *
   * @private
   * @returns built objects
   */
  protected toInstanceArray(input: AllowIterable<T | Exclude<T[TargetKey], any[]>> | null): T[] {
    const normalizedInput = this.toInstanceOrPkArray(input);

    // TODO: remove eslint-disable once we drop support for < 5.2
    // eslint-disable-next-line @typescript-eslint/prefer-ts-expect-error -- TS 5.2 works, but < 5.2 does not
    // @ts-ignore
    return normalizedInput.map(element => {
      if (element instanceof this.target) {
        return element;
      }

      const tmpInstance = Object.create(null);
      // @ts-expect-error -- TODO: what if the target has no primary key?
      tmpInstance[this.target.primaryKeyAttribute] = element;

      return this.target.build(tmpInstance, { isNewRecord: false });
    });
  }
}

export type SingleAssociationAccessors = {
  get: string;
  set: string;
  create: string;
};

export type MultiAssociationAccessors = {
  get: string;
  set: string;
  addMultiple: string;
  add: string;
  create: string;
  remove: string;
  removeMultiple: string;
  hasSingle: string;
  hasAll: string;
  count: string;
};

/** Foreign Key Options */
export interface ForeignKeyOptions<ForeignKey extends string>
  extends PartialBy<AttributeOptions, 'type'> {
  /**
   * The name of the foreign key attribute.
   *
   * Not to be confused with {@link AttributeOptions#columnName} which controls the name of the foreign key Column.
   */
  name?: ForeignKey;

  /**
   * Alias of {@link ForeignKeyOptions#name}.
   *
   * @deprecated
   */
  fieldName?: string;
}

export type NormalizedAssociationOptions<ForeignKey extends string> =
  NormalizeBaseAssociationOptions<AssociationOptions<ForeignKey>>;

/**
 * Options provided when associating models
 */
export interface AssociationOptions<ForeignKey extends string = string> extends Hookable {
  /**
   * The alias of this model, in singular form. See also the `name` option passed to `sequelize.define`. If
   * you create multiple associations between the same tables, you should provide an alias to be able to
   * distinguish between them. If you provide an alias when creating the association, you should provide the
   * same alias when eager loading and when getting associated models. Defaults to the singularized name of
   * target
   */
  as?: string | { singular: string; plural: string };

  /**
   * The configuration of the foreign key Attribute. See {@link Sequelize#define}
   * or {@link Model.init} for more information about the syntax.
   *
   * Using a string is equivalent to passing a {@link ForeignKeyOptions} object
   * with the {@link ForeignKeyOptions.name} option set.
   */
  foreignKey?: ForeignKey | ForeignKeyOptions<ForeignKey>;

  /**
   * Should ON UPDATE, ON DELETE, and REFERENCES constraints be enabled on the foreign key.
   */
  foreignKeyConstraints?: boolean;

  scope?: AssociationScope;
}

/**
 * Options for Association Scope
 */
export interface AssociationScope {
  /**
   * The name of the column that will be used for the associated scope and it's value
   */
  [scopeName: string]: unknown;
}

/**
 * Options provided for many-to-many relationships
 */
export interface MultiAssociationOptions<ForeignKey extends string>
  extends AssociationOptions<ForeignKey> {
  /**
   * A key/value set that will be used for association create and find defaults on the target.
   * (sqlite not supported for N:M)
   */
  scope?: AssociationScope;
}
