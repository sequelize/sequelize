import upperFirst from 'lodash/upperFirst';
import type { DataType } from '../data-types.js';
import { Model } from '../model';
import type {
  CreateOptions,
  CreationAttributes,
  FindOptions,
  SaveOptions,
  ModelStatic,
  AttributeNames,
  ModelAttributeColumnOptions,
  Attributes,
} from '../model';
import { Op } from '../operators';
import * as Utils from '../utils';
import type { AssociationOptions, SingleAssociationAccessors } from './base';
import { Association } from './base';
import * as Helpers from './helpers';

// TODO: strictly type mixin options

/**
 * One-to-one association
 *
 * In the API reference below, add the name of the association to the method, e.g. for `User.hasOne(Project)` the getter will be `user.getProject()`.
 * This is almost the same as `belongsTo` with one exception - The foreign key will be defined on the target model.
 *
 * See {@link Model.hasOne}
 *
 * @typeParam S The model on which {@link Model.hasOne} has been called, on which the association methods will be added.
 * @typeParam T The model passed to {@link Model.hasOne}. This model will receive the Foreign Key attribute.
 * @typeParam SourceKey The name of the attribute that the foreign key in the target model will reference.
 * @typeParam TargetKey The name of the Foreign Key attribute on the Target model.
 * @typeParam TargetPrimaryKey The name of the Primary Key attribute of the Target model. Used by {@link HasOneSetAssociationMixin}.
 */
export class HasOne<
  S extends Model = Model,
  T extends Model = Model,
  SourceKey extends AttributeNames<S> = any,
  TargetKey extends AttributeNames<T> = any,
  TargetPrimaryKey extends AttributeNames<T> = any,
> extends Association<S, T, HasOneOptions<S>, TargetKey> {
  associationType = 'HasOne';
  isSingleAssociation = true;

  /**
   * The name of the attribute the foreign key points to.
   * In HasOne, it is on the Source Model, instead of the Target Model (unlike {@link BelongsTo.targetKey}).
   * The {@link Association.foreignKey} is on the Target Model.
   */
  readonly sourceKey: SourceKey;

  /**
   * The Column Name of the source key.
   */
  readonly sourceKeyField: string;

  readonly sourceKeyAttribute: string;

  /**
   * A column name
   */
  identifierField: string | undefined;

  readonly accessors: SingleAssociationAccessors;

  constructor(source: ModelStatic<S>, target: ModelStatic<T>, options: HasOneOptions<S>) {
    super(source, target, options);

    if (
      this.options.sourceKey
      && !this.source.getAttributes()[this.options.sourceKey]
    ) {
      throw new Error(`Unknown attribute "${this.options.sourceKey}" passed as sourceKey, define this attribute on model "${this.source.name}" first`);
    }

    // TODO: throw is source model has a composite primary key.

    this.sourceKey = this.options.sourceKey || (this.source.primaryKeyAttribute as SourceKey);
    this.sourceKeyAttribute = this.sourceKey;
    this.sourceKeyField = this.source.getAttributes()[this.sourceKey].field || this.sourceKey;

    this.options.useHooks = options.useHooks;

    if (this.target.getAttributes()[this.foreignKey]) {
      this.identifierField = Utils.getColumnName(this.target.getAttributes()[this.foreignKey]);
    }

    // Get singular name, trying to uppercase the first letter, unless the model forbids it
    const singular = upperFirst(this.options.name.singular);

    this.accessors = {
      get: `get${singular}`,
      set: `set${singular}`,
      create: `create${singular}`,
    };

    this.#injectAttributes();
    this.#mixin(source.prototype);
  }

  /**
   * @private
   */
  #injectAttributes() {
    // the id is in the target table

    const newAttributes: Record<string, ModelAttributeColumnOptions> = {
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

    Helpers.addForeignKeyConstraints(newAttributes[this.foreignKey], this.source, this.options, this.sourceKeyField);

    this.target.mergeAttributes(newAttributes);

    this.identifierField = this.target.rawAttributes[this.foreignKey].field || this.foreignKey;

    Helpers.checkNamingCollision(this);

    return this;
  }

  #mixin(mixinTargetPrototype: Model) {
    Helpers.mixinMethods(this, mixinTargetPrototype, ['get', 'set', 'create']);
  }

  /**
   * Get the associated instance.
   *
   * See {@link HasOneGetAssociationMixinOptions} for a full explanation of options.
   * This method is mixed-in the source model prototype. See {@link HasOneGetAssociationMixin}.
   *
   * @param instances source instances
   * @param options find options
   */
  // TODO: when is this called with an array? Is it ever?
  async get(instances: S, options?: HasOneGetAssociationMixinOptions<T>): Promise<T | null>;
  async get(instances: S[], options?: HasOneGetAssociationMixinOptions<T>): Promise<Record<S[SourceKey], T | null>>;
  async get(
    instances: S | S[],
    options?: HasOneGetAssociationMixinOptions<T>,
  ): Promise<Record<S[SourceKey], T | null> | T | null> {
    options = options ? Utils.cloneDeep(options) : {};

    let Target = this.target;
    if (Object.prototype.hasOwnProperty.call(options, 'scope')) {
      if (!options.scope) {
        Target = Target.unscoped();
      } else if (options.scope !== true) { // 'true' means default scope. Which is the same as not doing anything.
        Target = Target.scope(options.scope);
      }
    }

    if (options.schema != null) {
      Target = Target.schema(options.schema, options.schemaDelimiter);
    }

    let isManyMode = true;
    if (!Array.isArray(instances)) {
      isManyMode = false;
      instances = [instances];
    }

    const where = Object.create(null);

    if (instances.length > 1) {
      where[this.foreignKey] = {
        [Op.in]: instances.map(instance => instance.get(this.sourceKey)),
      };
    } else {
      where[this.foreignKey] = instances[0].get(this.sourceKey);
    }

    if (this.scope) {
      Object.assign(where, this.scope);
    }

    options.where = options.where
      ? { [Op.and]: [where, options.where] }
      : where;

    if (isManyMode) {
      const results = await Target.findAll(options);
      const result: Record<S[SourceKey], T | null> = Object.create(null);
      for (const sourceInstance of instances) {
        result[sourceInstance.get(this.sourceKey, { raw: true })] = null;
      }

      for (const targetInstance of results) {
        result[targetInstance.get(this.foreignKey, { raw: true })] = targetInstance;
      }

      return result;
    }

    return Target.findOne(options);
  }

  /**
   * Set the associated model.
   *
   * @param sourceInstance the source instance
   * @param associatedInstanceOrPk An persisted instance or the primary key of an instance to associate with this. Pass `null` to remove the association.
   * @param options Options passed to getAssociation and `target.save`
   *
   * @returns The associated instance, or null if disassociated.
   */
  async set(
    sourceInstance: S, associatedInstanceOrPk: T | T[TargetPrimaryKey], options?: HasOneSetAssociationMixinOptions<T>,
  ): Promise<T>;
  async set(sourceInstance: S, associatedInstanceOrPk: null, options?: HasOneSetAssociationMixinOptions<T>): Promise<null>;
  async set(
    sourceInstance: S,
    associatedInstanceOrPk: T | T[TargetPrimaryKey] | null,
    options?: HasOneSetAssociationMixinOptions<T>,
  ): Promise<T | null> {
    // TODO: HasMany.set accepts CreationAttributes, this one should too (add tests)

    options = { ...options, scope: false };

    // @ts-expect-error -- .save isn't listed in the options because it's not supported but we'll still warn users if they use it.
    if (options.save === false) {
      throw new Error(`The "save: false" option cannot be honoured in ${this.source.name}#${this.accessors.set}
because, as this is a hasOne association, the foreign key we need to update is located on the model ${this.target.name}.`);
    }

    // calls the 'get' mixin
    const oldInstance: T | null = await this.get(sourceInstance, options);

    const alreadyAssociated = !oldInstance || !associatedInstanceOrPk ? false
      : associatedInstanceOrPk instanceof Model ? associatedInstanceOrPk.equals(oldInstance)
      : oldInstance.get(this.target.primaryKeyAttribute) === associatedInstanceOrPk;

    if (alreadyAssociated) {
      if (associatedInstanceOrPk instanceof Model) {
        return associatedInstanceOrPk;
      }

      return oldInstance;
    }

    if (oldInstance) {
      // TODO: if foreignKey is not allowed to be null, delete oldInstance.
      oldInstance.set(this.foreignKey, null);

      await oldInstance.save({
        ...options,
        fields: [this.foreignKey],
        // TODO: what is this 'allowNull' for?
        // allowNull: [this.foreignKey],
        association: true,
      });
    }

    if (associatedInstanceOrPk) {
      let associatedInstance: T;
      if (associatedInstanceOrPk instanceof this.target) {
        associatedInstance = associatedInstanceOrPk;
      } else {
        const tmpInstance = Object.create(null);
        tmpInstance[this.target.primaryKeyAttribute] = associatedInstanceOrPk;
        associatedInstance = this.target.build(tmpInstance, {
          isNewRecord: false,
        });
      }

      Object.assign(associatedInstance, this.scope);
      associatedInstance.set(this.foreignKey, sourceInstance.get(this.sourceKeyAttribute));

      return associatedInstance.save(options);
    }

    // disassociated
    return null;
  }

  /**
   * Create a new instance of the associated model and associate it with this.
   *
   * See {@link Model#create} for a full explanation of options.
   *
   * @param sourceInstance - the source instance
   * @param values - values to create associated model instance with
   * @param options - Options passed to `target.create` and setAssociation.
   *
   * @returns The created target model
   */
  async create(
    sourceInstance: S,
    // @ts-expect-error -- {} is not always assignable to 'values', but Target.create will enforce this, not us.
    values: CreationAttributes<T> = {},
    options: HasOneCreateAssociationMixinOptions<T> = {},
  ): Promise<T> {

    if (this.scope) {
      for (const attribute of Object.keys(this.scope)) {
        // @ts-expect-error
        values[attribute] = this.scope[attribute];
        if (options.fields) {
          options.fields.push(attribute);
        }
      }
    }

    // @ts-expect-error
    values[this.foreignKey] = sourceInstance.get(this.sourceKeyAttribute);
    if (options.fields) {
      options.fields.push(this.foreignKey);
    }

    return this.target.create(values, options);
  }
}

/**
 * Options provided when associating models with hasOne relationship
 */
export interface HasOneOptions<Source extends Model> extends AssociationOptions {

  /**
   * The name of the field to use as the key for the association in the source table.
   * Defaults to the primary key of the source table.
   *
   * This is the attribute the foreign key will target. Not to be confused with {@link AssociationOptions.foreignKey}.
   */
  sourceKey?: AttributeNames<Source>;

  /**
   * A string or a data type to represent the identifier in the table
   */
  keyType?: DataType;

  useHooks?: boolean;
}

/**
 * The options for the getAssociation mixin of the hasOne association.
 *
 * @see HasOneGetAssociationMixin
 */
export interface HasOneGetAssociationMixinOptions<M extends Model> extends FindOptions<Attributes<M>> {
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
 * @returns The associated model, or null if no model is associated. HasOne associations are always nullable because the foreign key is on the target model.
 *
 * @see https://sequelize.org/master/class/lib/associations/has-one.js~HasOne.html
 * @see Instance
 */
export type HasOneGetAssociationMixin<
  T extends Model,
> = (options?: HasOneGetAssociationMixinOptions<T>) => Promise<T | null>;

/**
 * The options for the setAssociation mixin of the hasOne association.
 *
 * @see HasOneSetAssociationMixin
 */
export interface HasOneSetAssociationMixinOptions<T extends Model>
  extends HasOneGetAssociationMixinOptions<T>, SaveOptions<any> {
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
 */
export type HasOneSetAssociationMixin<T extends Model, TModelPrimaryKey> = {
  (newAssociation: null, options?: HasOneSetAssociationMixinOptions<T>): Promise<null>,
  (newAssociation: T | TModelPrimaryKey, options?: HasOneSetAssociationMixinOptions<T>): Promise<T>,
};

/**
 * The options for the createAssociation mixin of the hasOne association.
 *
 * @see HasOneCreateAssociationMixin
 */
export interface HasOneCreateAssociationMixinOptions<M extends Model>
  extends Omit<HasOneSetAssociationMixinOptions<M>, 'fields'>, CreateOptions<Attributes<M>> {}

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
export type HasOneCreateAssociationMixin<T extends Model> = (
  // TODO: omit the foreign key
  values?: CreationAttributes<T>,
  options?: HasOneCreateAssociationMixinOptions<T>
) => Promise<T>;
