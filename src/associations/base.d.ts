import { ColumnOptions, Model, ModelCtor, Hookable } from '../model';

export abstract class Association<S extends Model = Model, T extends Model = Model> {
  public associationType: string;
  public source: ModelCtor<S>;
  public target: ModelCtor<T>;
  public isSelfAssociation: boolean;
  public isSingleAssociation: boolean;
  public isMultiAssociation: boolean;
  public as: string;
  public isAliased: boolean;
  public foreignKey: string;
  public identifier: string;
  public inspect(): string;
}

export interface SingleAssociationAccessors {
  get: string;
  set: string;
  create: string;
}

export interface MultiAssociationAccessors {
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
}

/** Foreign Key Options */
export interface ForeignKeyOptions extends ColumnOptions {
  /** Attribute name for the relation */
  name?: string;
}

/**
 * Options provided when associating models
 */
export interface AssociationOptions extends Hookable {
  /**
   * The alias of this model, in singular form. See also the `name` option passed to `sequelize.define`. If
   * you create multiple associations between the same tables, you should provide an alias to be able to
   * distinguish between them. If you provide an alias when creating the assocition, you should provide the
   * same alias when eager loading and when getting associated models. Defaults to the singularized name of
   * target
   */
  as?: string | { singular: string; plural: string };

  /**
   * The name of the foreign key in the target table or an object representing the type definition for the
   * foreign column (see `Sequelize.define` for syntax). When using an object, you can add a `name` property
   * to set the name of the column. Defaults to the name of source + primary key of source
   */
  foreignKey?: string | ForeignKeyOptions;

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
export interface ManyToManyOptions extends AssociationOptions {
  /**
   * A key/value set that will be used for association create and find defaults on the target.
   * (sqlite not supported for N:M)
   */
  scope?: AssociationScope;
}
