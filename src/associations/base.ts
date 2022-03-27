import assert from 'assert';
import isObject from 'lodash/isObject';
import isPlainObject from 'lodash/isPlainObject';
import { AssociationError } from '../errors';
import type { Model, ModelStatic, ColumnOptions, Hookable, BuiltModelName, AttributeNames } from '../model';
import type { AllowArray } from '../utils';
import * as Utils from '../utils';

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
 * User.belongsTo(Picture, { as: 'ProfilePicture', constraints: false })
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
 * Note how we also specified `constraints: false` for profile picture. This is because we add a foreign key from user to picture (profilePictureId), and from picture to user (userId). If we were to add foreign keys to both, it would create a cyclic dependency, and sequelize would not know which table to create first, since user depends on picture, and picture depends on user. These kinds of problems are detected by sequelize before the models are synced to the database, and you will get an error along the lines of `Error: Cyclic dependency found. 'users' is dependent of itself`. If you encounter this, you should either disable some constraints, or rethink your associations completely.
 */
export abstract class Association<
  S extends Model = Model,
  T extends Model = Model,
  ForeignKey extends string = string,
  Opts extends AssociationOptions<ForeignKey> = AssociationOptions<ForeignKey>,
> {
  /**
   * The type of the association. One of `HasMany`, `BelongsTo`, `HasOne`, `BelongsToMany`
   *
   * @type {string}
   */
  associationType: string = '';
  source: ModelStatic<S>;
  target: ModelStatic<T>;
  isSelfAssociation: boolean;
  // this property is overwritten by subclasses
  isSingleAssociation: boolean = false;
  // this property is overwritten by subclasses
  isMultiAssociation: boolean = false;
  isAliased: boolean;
  options: Omit<Opts, 'as'> & {
    as: string,
    name: { singular: string, plural: string },
  };

  abstract accessors: Record</* methodName in association */ string, /* method name in model */ string>;

  foreignKeyAttribute: ForeignKeyOptions<ForeignKey>;
  foreignKey: ForeignKey;

  attributeReferencedByForeignKey: string;

  constructor(source: ModelStatic<S>, target: ModelStatic<T>, attributeReferencedByForeignKey: string, options?: Opts) {
    this.source = source;
    this.target = target;
    this.attributeReferencedByForeignKey = attributeReferencedByForeignKey;

    this.isSelfAssociation
      // @ts-expect-error -- TypeScript thinks ModelStatic & ModelStatic have no overlap.
      = this.source === this.target;

    this.isAliased = Boolean(options?.as);

    let name: { singular: string, plural: string };
    let as: string;
    if (options?.as) {
      if (isPlainObject(options.as)) {
        assert(typeof options.as === 'object');
        name = options.as;
        as = options.as.plural;
      } else {
        assert(typeof options.as === 'string');
        as = options.as;
        name = {
          plural: options.as,
          singular: Utils.singularize(options.as),
        };
      }
    } else {
      as = this.target.options.name.plural;
      name = this.target.options.name;
    }

    // @ts-expect-error
    this.options = {
      ...options,
      as,
      name,
    };

    if (source.hasAlias(this.as)) {
      throw new AssociationError(`Association ${this.as} has already been defined on model ${source.name}. Use another alias using the "as" parameter.`);
    }

    this.foreignKeyAttribute = {};

    let foreignKey: string | undefined;
    if (isObject(options?.foreignKey)) {
      // lodash has poor typings
      assert(typeof options?.foreignKey === 'object');

      this.foreignKeyAttribute = options.foreignKey;
      foreignKey = this.foreignKeyAttribute.name
        || this.foreignKeyAttribute.fieldName;
    } else if (options?.foreignKey) {
      foreignKey = options.foreignKey;
    }

    if (!foreignKey) {
      foreignKey = this.inferForeignKey();
    }

    this.foreignKey = foreignKey as ForeignKey;
  }

  /**
   * The identifier of the relation on the source model.
   */
  get as(): string {
    return this.options.as;
  }

  get scope(): AssociationScope | undefined {
    return this.options.scope;
  }

  protected inferForeignKey() {
    const associationName = this.options.as ? Utils.singularize(this.options.as) : this.source.options.name.singular;
    if (!associationName) {
      throw new Error('Sanity check: Could not guess the name of the association');
    }

    return Utils.camelize(`${associationName}_${this.attributeReferencedByForeignKey}`);
  }

  verifyAssociationAlias(alias: string | BuiltModelName): boolean {
    if (typeof alias === 'string') {
      return this.as === alias;
    }

    if (this.isMultiAssociation) {
      if (alias?.plural) {
        return this.as === alias.plural;
      }
    } else if (alias?.singular) {
      return this.as === alias.singular;
    }

    return !this.isAliased;
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
  Opts extends MultiAssociationOptions<ForeignKey> = MultiAssociationOptions<ForeignKey>,
> extends Association<S, T, ForeignKey, Opts> {

  /**
   * Normalize input
   *
   * @param input it may be array or single obj, instance or primary key
   *
   * @private
   * @returns built objects
   */
  protected toInstanceArray(input: AllowArray<T | Exclude<T[TargetKey], any[]>>): T[] {
    if (!Array.isArray(input)) {
      input = [input];
    }

    return input.map(element => {
      if (element instanceof this.target) {
        return element as T;
      }

      const tmpInstance = Object.create(null);
      tmpInstance[this.target.primaryKeyAttribute] = element;

      return this.target.build(tmpInstance, { isNewRecord: false });
    });
  }
}

export type SingleAssociationAccessors = {
  get: string,
  set: string,
  create: string,
};

export type MultiAssociationAccessors = {
  get: string,
  set: string,
  addMultiple: string,
  add: string,
  create: string,
  remove: string,
  removeMultiple: string,
  hasSingle: string,
  hasAll: string,
  count: string,
};

/** Foreign Key Options */
export interface ForeignKeyOptions<ForeignKey extends string> extends ColumnOptions {
  /**
   * The name of the foreign key attribute.
   *
   * Not to be confused with {@link ColumnOptions#field} which controls the name of the foreign key Column.
   */
  name?: ForeignKey;

  /**
   * Alias of {@link ForeignKeyOptions#name}.
   *
   * @deprecated
   */
  fieldName?: string;
}

/**
 * Options provided when associating models
 */
export interface AssociationOptions<ForeignKey extends string> extends Hookable {
  /**
   * The alias of this model, in singular form. See also the `name` option passed to `sequelize.define`. If
   * you create multiple associations between the same tables, you should provide an alias to be able to
   * distinguish between them. If you provide an alias when creating the association, you should provide the
   * same alias when eager loading and when getting associated models. Defaults to the singularized name of
   * target
   */
  as?: string | { singular: string, plural: string };

  /**
   * The configuration of the foreign key Attribute. See {@link Sequelize#define}
   * or {@link Model.init} for more information about the syntax.
   *
   * Using a string is equivalent to passing a {@link ForeignKeyOptions} object
   * with the {@link ForeignKeyOptions.name} option set.
   */
  foreignKey?: ForeignKey | ForeignKeyOptions<ForeignKey>;

  /**
   * What happens when delete occurs.
   *
   * Cascade if this is a n:m, and set null if it is a 1:m
   *
   * @default 'SET NULL' or 'CASCADE'
   */
  onDelete?: string;

  /**
   * What happens when update occurs
   *
   * @default 'CASCADE'
   */
  onUpdate?: string;

  /**
   * Should on update and on delete constraints be enabled on the foreign key.
   */
  constraints?: boolean;
  foreignKeyConstraint?: boolean;

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
export interface MultiAssociationOptions<ForeignKey extends string> extends AssociationOptions<ForeignKey> {
  /**
   * A key/value set that will be used for association create and find defaults on the target.
   * (sqlite not supported for N:M)
   */
  scope?: AssociationScope;
}
