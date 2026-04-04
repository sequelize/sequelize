import type { AllowIterable, RequiredBy } from '@sequelize/utils';
import { EMPTY_ARRAY, EMPTY_OBJECT } from '@sequelize/utils';
import each from 'lodash/each';
import isEqual from 'lodash/isEqual';
import omit from 'lodash/omit';
import upperFirst from 'lodash/upperFirst';
import type { WhereOptions } from '../abstract-dialect/where-sql-builder-types.js';
import { AssociationError } from '../errors';
import { col } from '../expression-builders/col.js';
import { fn } from '../expression-builders/fn.js';
import type {
  AttributeNames,
  Attributes,
  BulkCreateOptions,
  CreateOptions,
  CreationAttributes,
  Filterable,
  FindAttributeOptions,
  FindOptions,
  Includeable,
  InstanceDestroyOptions,
  InstanceUpdateOptions,
  Model,
  ModelAttributes,
  ModelOptions,
  ModelStatic,
  Transactionable,
  UpdateOptions,
} from '../model';
import { Op } from '../operators';
import type { Sequelize } from '../sequelize';
import { isModelStatic, isSameInitialModel } from '../utils/model-utils.js';
import { removeUndefined } from '../utils/object.js';
import { camelize, singularize } from '../utils/string.js';
import type {
  Association,
  AssociationOptions,
  AssociationScope,
  ForeignKeyOptions,
  MultiAssociationAccessors,
  MultiAssociationOptions,
  NormalizedAssociationOptions,
} from './base';
import { MultiAssociation } from './base';
import type { BelongsToAssociation } from './belongs-to.js';
import { HasManyAssociation } from './has-many.js';
import { HasOneAssociation } from './has-one.js';
import type { AssociationStatic, MaybeForwardedModelStatic } from './helpers';
import {
  AssociationSecret,
  defineAssociation,
  isThroughOptions,
  mixinMethods,
  normalizeBaseAssociationOptions,
  normalizeForeignKeyOptions,
  normalizeInverseAssociation,
} from './helpers';

function addInclude(findOptions: FindOptions, include: Includeable) {
  if (Array.isArray(findOptions.include)) {
    findOptions.include.push(include);
  } else if (!findOptions.include) {
    findOptions.include = [include];
  } else {
    findOptions.include = [findOptions.include, include];
  }
}

/**
 * Many-to-many association with a join/through table.
 * See {@link Model.belongsToMany}
 *
 * When the join table has additional attributes, these can be passed in the options object:
 *
 * ```js
 * UserProject = sequelize.define('user_project', {
 *   role: DataTypes.STRING
 * });
 * User.belongsToMany(Project, { through: UserProject });
 * Project.belongsToMany(User, { through: UserProject });
 * // through is required!
 *
 * user.addProject(project, { through: { role: 'manager' }});
 * ```
 *
 * All methods allow you to pass either a persisted instance, its primary key, or a mixture:
 *
 * ```js
 * const project = await Project.create({ id: 11 });
 * await user.addProjects([project, 12]);
 * ```
 *
 * If you want to set several target instances, but with different attributes you have to set the attributes on the instance, using a property with the name of the through model:
 *
 * ```js
 * p1.UserProjects = {
 *   started: true
 * }
 * user.setProjects([p1, p2], { through: { started: false }}) // The default value is false, but p1 overrides that.
 * ```
 *
 * Similarly, when fetching through a join table with custom attributes, these attributes will be available as an object with the name of the through model.
 * ```js
 * const projects = await user.getProjects();
 * const p1 = projects[0];
 * p1.UserProjects.started // Is this project started yet?
 * ```
 *
 * In the API reference below, add the name of the association to the method, e.g. for `User.belongsToMany(Project)` the getter will be `user.getProjects()`.
 */
// Note: this class is named BelongsToManyAssociation instead of BelongsToMany to prevent naming conflicts with the BelongsToMany decorator
export class BelongsToManyAssociation<
  SourceModel extends Model = Model,
  TargetModel extends Model = Model,
  ThroughModel extends Model = Model,
  SourceKey extends AttributeNames<SourceModel> = any,
  TargetKey extends AttributeNames<TargetModel> = any,
> extends MultiAssociation<
  SourceModel,
  TargetModel,
  /* ForeignKey */ string,
  TargetKey,
  NormalizedBelongsToManyOptions<SourceKey, TargetKey, ThroughModel>
> {
  readonly accessors: MultiAssociationAccessors;

  get foreignKey(): string {
    return this.fromSourceToThrough.foreignKey;
  }

  /**
   * The name of the Foreign Key attribute, located on the through table, that points to the Target model.
   *
   * Not to be confused with {@link BelongsToManyAssociation#foreignKey}, which points to the Source model instead.
   */
  get otherKey(): string {
    return this.pairedWith.foreignKey;
  }

  /**
   * @deprecated use {@link BelongsToManyAssociation#foreignKey}
   */
  get identifier() {
    return this.foreignKey;
  }

  /**
   * The corresponding column name of {@link BelongsToManyAssociation#foreignKey}
   */
  get identifierField(): string {
    return this.fromThroughToSource.identifierField;
  }

  /**
   * The corresponding column name of {@link BelongsToManyAssociation#otherKey}
   */
  get foreignIdentifierField() {
    return this.pairedWith.identifierField;
  }

  /**
   * The name of the Attribute that the {@link foreignKey} fk (located on the Through Model) will reference on the Source model.
   */
  get sourceKey(): SourceKey {
    return this.fromThroughToSource.targetKey;
  }

  /**
   * The name of the Column that the {@link foreignKey} fk (located on the Through Table) will reference on the Source model.
   */
  get sourceKeyField(): string {
    return this.fromThroughToSource.targetKeyField;
  }

  /**
   * The name of the Attribute that the {@link otherKey} fk (located on the Through Model) will reference on the Target model.
   */
  get targetKey(): TargetKey {
    return this.pairedWith.sourceKey;
  }

  /**
   * The name of the Column that the {@link otherKey} fk (located on the Through Table) will reference on the Target model.
   */
  get targetKeyField(): string {
    return this.pairedWith.sourceKeyField;
  }

  /**
   * The corresponding association this entity is paired with.
   */
  pairedWith: BelongsToManyAssociation<
    TargetModel,
    SourceModel,
    ThroughModel,
    TargetKey,
    SourceKey
  >;

  // intermediary associations
  // these create the actual associations on the model. Remove them would be a breaking change.
  readonly fromSourceToThrough: HasManyAssociation<SourceModel, ThroughModel, SourceKey, any>;
  readonly fromSourceToThroughOne: HasOneAssociation<SourceModel, ThroughModel, SourceKey, any>;
  get fromThroughToSource(): BelongsToAssociation<ThroughModel, SourceModel, any, SourceKey> {
    return this.fromSourceToThrough.inverse;
  }

  get fromTargetToThrough(): HasManyAssociation<TargetModel, ThroughModel, TargetKey, any> {
    return this.pairedWith.fromSourceToThrough;
  }

  get fromTargetToThroughOne(): HasOneAssociation<TargetModel, ThroughModel, TargetKey, any> {
    return this.pairedWith.fromSourceToThroughOne;
  }

  get fromThroughToTarget(): BelongsToAssociation<ThroughModel, TargetModel, any, TargetKey> {
    return this.pairedWith.fromThroughToSource;
  }

  get through(): NormalizedThroughOptions<ThroughModel> {
    return this.options.through;
  }

  get throughModel(): ModelStatic<ThroughModel> {
    return this.through.model;
  }

  constructor(
    secret: symbol,
    source: ModelStatic<SourceModel>,
    target: ModelStatic<TargetModel>,
    options: NormalizedBelongsToManyOptions<SourceKey, TargetKey, ThroughModel>,
    pair?: BelongsToManyAssociation<TargetModel, SourceModel, ThroughModel, TargetKey, SourceKey>,
    parent?: Association<any>,
  ) {
    super(secret, source, target, options, parent);

    try {
      this.pairedWith =
        pair ??
        BelongsToManyAssociation.associate<
          TargetModel,
          SourceModel,
          ThroughModel,
          TargetKey,
          SourceKey
        >(
          secret,
          target,
          source,
          removeUndefined({
            ...options,
            // note: we can't just use '...options.inverse' because we need to set to undefined if the option wasn't set
            as: options.inverse?.as,
            scope: options.inverse?.scope,
            foreignKeyConstraints: options.inverse?.foreignKeyConstraints,
            inverse: removeUndefined({
              as: options.as,
              scope: options.scope,
              foreignKeyConstraints: options.foreignKeyConstraints,
            }),
            sourceKey: options.targetKey,
            targetKey: options.sourceKey,
            foreignKey: options.otherKey,
            otherKey: options.foreignKey,
            throughAssociations: {
              toSource: options.throughAssociations.toTarget,
              fromSource: options.throughAssociations.fromTarget,
              toTarget: options.throughAssociations.toSource,
              fromTarget: options.throughAssociations.fromSource,
            },
            through: removeUndefined({
              ...options.through,
              scope: undefined,
            }),
          }),
          this,
          this,
        );
    } catch (error) {
      throw new AssociationError(
        `BelongsToMany associations automatically create the corresponding association on the target model,
    but this association failed to create its paired association (BelongsToMany from ${target.name} to ${source.name}).

    This may happen if you try to define the same BelongsToMany association on both sides of the association.
    If that is the case, instead of doing this:
    A.belongsToMany(B, { as: 'b', through: 'AB' });
    B.belongsToMany(A, { as: 'a', through: 'AB' });

    Do this:
    A.belongsToMany(B, { as: 'b', through: 'AB', inverse: { as: 'a' } });
          `,
        { cause: error },
      );
    }

    // we'll need to access their foreign key (through .otherKey) in this constructor.
    // this makes sure it's created
    this.pairedWith.pairedWith = this;

    const sourceKey = options?.sourceKey || (source.primaryKeyAttribute as TargetKey);

    this.fromSourceToThrough = HasManyAssociation.associate(
      AssociationSecret,
      this.source,
      this.throughModel,
      removeUndefined({
        as:
          options.throughAssociations.fromSource ||
          `${this.name.plural}${upperFirst(this.pairedWith.name.plural)}`,
        scope: this.through.scope,
        foreignKey: {
          ...this.options.foreignKey,
          allowNull: this.options.foreignKey.allowNull ?? false,
          name:
            this.options.foreignKey.name ||
            (this.isSelfAssociation
              ? camelize(`${this.pairedWith.name.singular}_${sourceKey}`)
              : camelize(`${this.source.options.name.singular}_${sourceKey}`)),
        },
        sourceKey: this.options.sourceKey,
        foreignKeyConstraints: this.options.foreignKeyConstraints,
        hooks: this.options.hooks,
        inverse: {
          as: options.throughAssociations.toSource || this.pairedWith.name.singular,
        },
      }),
      this,
    );

    this.fromSourceToThroughOne = HasOneAssociation.associate(
      AssociationSecret,
      this.source,
      this.throughModel,
      removeUndefined({
        as: options.throughAssociations.fromSource
          ? singularize(options.throughAssociations.fromSource)
          : `${this.name.singular}${upperFirst(this.pairedWith.name.singular)}`,
        scope: this.through.scope,
        // foreignKey: this.options.foreignKey,
        foreignKey: {
          ...this.options.foreignKey,
          allowNull: this.options.foreignKey.allowNull ?? false,
          name:
            this.options.foreignKey.name ||
            (this.isSelfAssociation
              ? camelize(`${this.pairedWith.name.singular}_${sourceKey}`)
              : camelize(`${this.source.options.name.singular}_${sourceKey}`)),
        },
        sourceKey: this.options.sourceKey,
        foreignKeyConstraints: this.options.foreignKeyConstraints,
        hooks: this.options.hooks,
        inverse: {
          as: options.throughAssociations.toSource
            ? singularize(options.throughAssociations.toSource)
            : this.pairedWith.name.singular,
        },
      }),
      this,
    );

    // Get singular and plural names, trying to uppercase the first letter, unless the model forbids it
    const plural = upperFirst(this.options.name.plural);
    const singular = upperFirst(this.options.name.singular);

    this.accessors = {
      get: `get${plural}`,
      set: `set${plural}`,
      addMultiple: `add${plural}`,
      add: `add${singular}`,
      create: `create${singular}`,
      remove: `remove${singular}`,
      removeMultiple: `remove${plural}`,
      hasSingle: `has${singular}`,
      hasAll: `has${plural}`,
      count: `count${plural}`,
    };

    this.#mixin(source.prototype);

    // we are the 'parent' of the belongs-to-many pair
    if (pair == null) {
      this.#makeFkPairUnique();
    }
  }

  #makeFkPairUnique() {
    let hasPrimaryKey = false;

    const throughModelDefinition = this.throughModel.modelDefinition;

    // remove any PKs previously defined by sequelize
    // but ignore any keys that are part of this association (#5865)
    const { rawAttributes: throughRawAttributes } = throughModelDefinition;

    each(throughRawAttributes, (attribute, attributeName) => {
      if (!attribute.primaryKey) {
        return;
      }

      if ([this.foreignKey, this.otherKey].includes(attributeName)) {
        return;
      }

      if (attribute._autoGenerated) {
        delete throughRawAttributes[attributeName];

        return;
      }

      hasPrimaryKey = true;
    });

    if (!hasPrimaryKey) {
      if (typeof this.through.unique === 'string') {
        throw new TypeError(`BelongsToMany: Option "through.unique" can only be used if the through model's foreign keys are not also the primary keys.
Add your own primary key to the through model, on different attributes than the foreign keys, to be able to use this option.`);
      }

      throughRawAttributes[this.foreignKey].primaryKey = true;
      throughRawAttributes[this.otherKey].primaryKey = true;
    } else if (this.through.unique !== false) {
      let uniqueKey;
      if (typeof this.through.unique === 'string' && this.through.unique !== '') {
        uniqueKey = this.through.unique;
      } else {
        const keys = [this.foreignKey, this.otherKey].sort();
        uniqueKey = [this.through.model.table.tableName, ...keys, 'unique'].join('_');
      }

      throughRawAttributes[this.foreignKey].unique = [{ name: uniqueKey }];
      throughRawAttributes[this.otherKey].unique = [{ name: uniqueKey }];
    }

    throughModelDefinition.refreshAttributes();
  }

  static associate<
    S extends Model,
    T extends Model,
    ThroughModel extends Model,
    SourceKey extends AttributeNames<S>,
    TargetKey extends AttributeNames<T>,
  >(
    secret: symbol,
    source: ModelStatic<S>,
    target: ModelStatic<T>,
    options: BelongsToManyOptions<SourceKey, TargetKey, ThroughModel>,
    pair?: BelongsToManyAssociation<T, S, ThroughModel, TargetKey, SourceKey>,
    parent?: Association<any>,
  ): BelongsToManyAssociation<S, T, ThroughModel, SourceKey, TargetKey> {
    return defineAssociation<
      BelongsToManyAssociation<S, T, ThroughModel, SourceKey, TargetKey>,
      BelongsToManyOptions<SourceKey, TargetKey, ThroughModel>,
      NormalizedBelongsToManyOptions<SourceKey, TargetKey, ThroughModel>
    >(
      BelongsToManyAssociation,
      source,
      target,
      options,
      parent,
      normalizeBelongsToManyOptions,
      newOptions => {
        // self-associations must always set their 'as' parameter
        if (
          isSameInitialModel(source, target) &&
          // use 'options' because this will always be set in 'newOptions'
          (!options.as || !newOptions.inverse?.as || options.as === newOptions.inverse.as)
        ) {
          throw new AssociationError(
            'Both options "as" and "inverse.as" must be defined for belongsToMany self-associations, and their value must be different.',
          );
        }

        return new BelongsToManyAssociation(secret, source, target, newOptions, pair, parent);
      },
    );
  }

  #mixin(modelPrototype: Model) {
    mixinMethods(
      this,
      modelPrototype,
      [
        'get',
        'count',
        'hasSingle',
        'hasAll',
        'set',
        'add',
        'addMultiple',
        'remove',
        'removeMultiple',
        'create',
      ],
      {
        hasSingle: 'has',
        hasAll: 'has',
        addMultiple: 'add',
        removeMultiple: 'remove',
      },
    );
  }

  /**
   * Get everything currently associated with this, using an optional where clause.
   *
   * See {@link Model} for a full explanation of options
   *
   * @param instance instance
   * @param options find options
   */
  async get(
    instance: SourceModel,
    options?: BelongsToManyGetAssociationsMixinOptions<TargetModel>,
  ): Promise<TargetModel[]> {
    const through = this.through;

    const findOptions: FindOptions<Attributes<TargetModel>> = {
      ...options,
      // @ts-expect-error -- TODO: current WhereOptions typings do not allow having 'WhereOptions' inside another 'WhereOptions'
      where: {
        [Op.and]: [options?.where, this.scope],
      },
    };

    let throughWhere = {
      [this.foreignKey]: instance.get(this.sourceKey),
    };

    if (through.scope) {
      Object.assign(throughWhere, through.scope);
    }

    // If a user pass a where on the options through options, make an "and" with the current throughWhere
    if (options?.through?.where) {
      throughWhere = {
        [Op.and]: [throughWhere, options.through.where],
      };
    }

    addInclude(
      findOptions,
      removeUndefined({
        association: this.fromTargetToThroughOne,
        attributes: options?.joinTableAttributes,
        required: true,
        paranoid: options?.through?.paranoid ?? true,
        where: throughWhere,
      }),
    );

    let model = this.target;
    if (options?.scope != null) {
      if (!options.scope) {
        model = model.withoutScope();
      } else if (options.scope !== true) {
        // 'true' means default scope. Which is the same as not doing anything.
        model = model.withScope(options.scope);
      }
    }

    if (options?.schema) {
      model = model.withSchema({
        schema: options.schema,
        schemaDelimiter: options.schemaDelimiter,
      });
    }

    return model.findAll(findOptions);
  }

  /**
   * Count everything currently associated with this, using an optional where clause.
   *
   * @param instance instance
   * @param options find options
   */
  async count(
    instance: SourceModel,
    options?: BelongsToManyCountAssociationsMixinOptions<TargetModel>,
  ): Promise<number> {
    const getOptions: BelongsToManyGetAssociationsMixinOptions<TargetModel> = {
      ...options,
      attributes: [[fn('COUNT', col([this.target.name, this.targetKeyField].join('.'))), 'count']],
      joinTableAttributes: [],
      raw: true,
      plain: true,
    };

    const result = await this.get(instance, getOptions);

    // @ts-expect-error -- this.get() isn't designed to expect returning a raw output.
    return Number.parseInt(result.count, 10);
  }

  /**
   * Check if one or more instance(s) are associated with this. If a list of instances is passed, the function returns true if _all_ instances are associated
   *
   * @param sourceInstance source instance to check for an association with
   * @param targetInstancesOrPks Can be an array of instances or their primary keys
   * @param options Options passed to getAssociations
   */
  async has(
    sourceInstance: SourceModel,
    targetInstancesOrPks: AllowIterable<TargetModel | Exclude<TargetModel[TargetKey], any[]>>,
    options?: BelongsToManyHasAssociationMixinOptions<TargetModel>,
  ): Promise<boolean> {
    const targets = this.toInstanceOrPkArray(targetInstancesOrPks);

    const targetPrimaryKeys: Array<TargetModel[TargetKey]> = targets.map(instance => {
      if (instance instanceof this.target) {
        // TODO: remove eslint-disable once we drop support for < 5.2
        // eslint-disable-next-line @typescript-eslint/prefer-ts-expect-error -- TS 5.2 works, but < 5.2 does not
        // @ts-ignore
        return instance.get(this.targetKey);
      }

      return instance as TargetModel[TargetKey];
    });

    const associatedObjects: TargetModel[] = await this.get(sourceInstance, {
      ...options,
      raw: true,
      scope: false,
      attributes: [this.targetKey],
      joinTableAttributes: [],
      // @ts-expect-error -- TODO: current WhereOptions typings do not allow having 'WhereOptions' inside another 'WhereOptions'
      where: {
        [Op.and]: [{ [this.targetKey]: { [Op.in]: targetPrimaryKeys } }, options?.where],
      },
    });

    return targetPrimaryKeys.every(pk => {
      return associatedObjects.some(instance => {
        // instance[x] instead of instance.get() because the query output is 'raw'
        // isEqual is used here because the PK can be a non-primitive value, such as a Buffer
        return isEqual(instance[this.targetKey], pk);
      });
    });
  }

  /**
   * Set the associated models by passing an array of instances or their primary keys.
   * Everything that it not in the passed array will be un-associated.
   *
   * @param sourceInstance source instance to associate new instances with
   * @param newInstancesOrPrimaryKeys A single instance or primary key, or a mixed array of persisted instances or primary keys
   * @param options Options passed to `through.findAll`, `bulkCreate`, `update` and `destroy`
   */
  async set(
    sourceInstance: SourceModel,
    newInstancesOrPrimaryKeys: AllowIterable<TargetModel | Exclude<TargetModel[TargetKey], any[]>>,
    options: BelongsToManySetAssociationsMixinOptions<TargetModel> = {},
  ): Promise<void> {
    const sourceKey = this.sourceKey;
    const targetKey = this.targetKey;
    const foreignKey = this.foreignKey;
    const otherKey = this.otherKey;

    const newInstances = this.toInstanceArray(newInstancesOrPrimaryKeys);

    const where: WhereOptions = {
      [foreignKey]: sourceInstance.get(sourceKey),
      ...this.through.scope,
    };

    // @ts-expect-error -- the findAll call is raw, no model here
    const currentThroughRows: ThroughModel[] = await this.through.model.findAll({
      ...options,
      where,
      raw: true,
      // force this option to be false, in case the user enabled
      rejectOnEmpty: false,
      include: this.scope
        ? [
            {
              association: this.fromThroughToTarget,
              where: this.scope,
              required: true,
            },
          ]
        : EMPTY_ARRAY,
    });

    const obsoleteTargets: Array<TargetModel | Exclude<TargetModel[TargetKey], any[]>> = [];

    // find all obsolete targets
    for (const currentRow of currentThroughRows) {
      const newTarget = newInstances.find(obj => {
        // @ts-expect-error -- the findAll call is raw, no model here
        return currentRow[otherKey] === obj.get(targetKey);
      });

      if (!newTarget) {
        // @ts-expect-error -- the findAll call is raw, no model here
        obsoleteTargets.push(currentRow[this.otherKey]);
      }
    }

    const promises: Array<Promise<any>> = [];
    if (obsoleteTargets.length > 0) {
      promises.push(this.remove(sourceInstance, obsoleteTargets, options));
    }

    if (newInstances.length > 0) {
      promises.push(
        this.#updateAssociations(sourceInstance, currentThroughRows, newInstances, options),
      );
    }

    await Promise.all(promises);
  }

  /**
   * Associate one or several rows with source instance. It will not un-associate any already associated instance
   * that may be missing from `newInstances`.
   *
   * @param sourceInstance source instance to associate new instances with
   * @param newInstancesOrPrimaryKeys A single instance or primary key, or a mixed array of persisted instances or primary keys
   * @param options Options passed to `through.findAll`, `bulkCreate` and `update`
   */
  async add(
    sourceInstance: SourceModel,
    newInstancesOrPrimaryKeys: AllowIterable<TargetModel | Exclude<TargetModel[TargetKey], any[]>>,
    options?: BelongsToManyAddAssociationsMixinOptions<TargetModel>,
  ): Promise<void> {
    const newInstances = this.toInstanceArray(newInstancesOrPrimaryKeys);
    if (newInstances.length === 0) {
      return;
    }

    const where: WhereOptions = {
      [this.foreignKey]: sourceInstance.get(this.sourceKey),
      [this.otherKey]: newInstances.map(newInstance => newInstance.get(this.targetKey)),
      ...this.through.scope,
    };

    let currentRows: readonly any[] = EMPTY_ARRAY;
    if (this.through?.unique ?? true) {
      // @ts-expect-error -- the findAll call is raw, no model here
      currentRows = await this.through.model.findAll({
        ...options,
        raw: true,
        where,
        // force this option to be false, in case the user enabled
        rejectOnEmpty: false,
      });
    }

    await this.#updateAssociations(sourceInstance, currentRows, newInstances, options);
  }

  /**
   * Adds new target instances that were not already present in the through table.
   * Updates the through table row of the instances that already were present.
   *
   * @param sourceInstance
   * @param currentThroughRows
   * @param newTargets
   * @param options
   * @private
   */
  async #updateAssociations(
    sourceInstance: SourceModel,
    currentThroughRows: readonly ThroughModel[],
    newTargets: readonly TargetModel[],
    options?: { through?: JoinTableAttributes } & BulkCreateOptions<Attributes<ThroughModel>> &
      Omit<UpdateOptions<Attributes<ThroughModel>>, 'where'>,
  ) {
    const sourceKey = this.sourceKey;
    const targetKey = this.targetKey;
    const foreignKey = this.foreignKey;
    const otherKey = this.otherKey;

    const defaultAttributes = options?.through || EMPTY_OBJECT;

    const promises: Array<Promise<any>> = [];
    const unassociatedTargets: TargetModel[] = [];
    // the 'through' table of these targets has changed
    const changedTargets: TargetModel[] = [];
    for (const newInstance of newTargets) {
      const existingThroughRow = currentThroughRows.find(throughRow => {
        // @ts-expect-error -- throughRow[] instead of .get because throughRows are loaded using 'raw'
        return throughRow[otherKey] === newInstance.get(targetKey);
      });

      if (!existingThroughRow) {
        unassociatedTargets.push(newInstance);

        continue;
      }

      // @ts-expect-error -- gets the content of the "through" table for this association that is set on the model
      const throughAttributes = newInstance[this.through.model.name];
      const attributes = { ...defaultAttributes, ...throughAttributes };

      if (
        Object.keys(attributes).some(attribute => {
          // @ts-expect-error -- existingThroughRow is raw
          return attributes[attribute] !== existingThroughRow[attribute];
        })
      ) {
        changedTargets.push(newInstance);
      }
    }

    if (unassociatedTargets.length > 0) {
      const bulk = unassociatedTargets.map(unassociatedTarget => {
        // @ts-expect-error -- gets the content of the "through" table for this association that is set on the model
        const throughAttributes = unassociatedTarget[this.through.model.name];
        const attributes = { ...defaultAttributes, ...throughAttributes };

        attributes[foreignKey] = sourceInstance.get(sourceKey);
        attributes[otherKey] = unassociatedTarget.get(targetKey);

        Object.assign(attributes, this.through.scope);

        return attributes;
      });

      promises.push(this.through.model.bulkCreate(bulk, { validate: true, ...options }));
    }

    for (const changedTarget of changedTargets) {
      // @ts-expect-error -- gets the content of the "through" table for this association that is set on the model
      let throughAttributes = changedTarget[this.through.model.name];
      const attributes = { ...defaultAttributes, ...throughAttributes };
      // Quick-fix for subtle bug when using existing objects that might have the through model attached (not as an attribute object)
      if (throughAttributes instanceof this.through.model) {
        throughAttributes = {};
      }

      const where: WhereOptions = {
        [foreignKey]: sourceInstance.get(sourceKey),
        [otherKey]: changedTarget.get(targetKey),
      };

      promises.push(
        this.through.model.update(attributes, {
          ...options,
          where,
        }),
      );
    }

    await Promise.all(promises);
  }

  /**
   * Un-associate one or more instance(s).
   *
   * @param sourceInstance instance to un associate instances with
   * @param targetInstanceOrPks Can be an Instance or its primary key, or a mixed array of instances and primary keys
   * @param options Options passed to `through.destroy`
   */
  async remove(
    sourceInstance: SourceModel,
    targetInstanceOrPks: AllowIterable<TargetModel | Exclude<TargetModel[TargetKey], any[]>>,
    options?: BelongsToManyRemoveAssociationMixinOptions,
  ): Promise<void> {
    const targetInstance = this.toInstanceArray(targetInstanceOrPks);
    if (targetInstance.length === 0) {
      return;
    }

    const where: WhereOptions = {
      [this.foreignKey]: sourceInstance.get(this.sourceKey),
      [this.otherKey]: targetInstance.map(newInstance => newInstance.get(this.targetKey)),
      ...this.through.scope,
    };

    await this.through.model.destroy({ ...options, where });
  }

  /**
   * Create a new instance of the associated model and associate it with this.
   *
   * @param sourceInstance source instance
   * @param values values for target model
   * @param options Options passed to create and add
   */
  async create(
    sourceInstance: SourceModel,
    // @ts-expect-error -- {} is not always assignable to 'values', but Target.create will enforce this, not us.
    values: CreationAttributes<TargetModel> = {},
    options:
      | BelongsToManyCreateAssociationMixinOptions<TargetModel>
      | BelongsToManyCreateAssociationMixinOptions<TargetModel>['fields'] = {},
  ): Promise<TargetModel> {
    if (Array.isArray(options)) {
      options = {
        fields: options,
      };
    }

    if (this.scope) {
      Object.assign(values, this.scope);
      if (options.fields) {
        options.fields = [...options.fields, ...Object.keys(this.scope)];
      }
    }

    // Create the related model instance
    const newAssociatedObject = await this.target.create(values, options);

    await this.add(sourceInstance, newAssociatedObject, omit(options, ['fields']));

    return newAssociatedObject;
  }
}

// workaround https://github.com/evanw/esbuild/issues/1260
Object.defineProperty(BelongsToManyAssociation, 'name', {
  value: 'BelongsToMany',
});

function normalizeThroughOptions<M extends Model>(
  source: ModelStatic<any>,
  target: ModelStatic<any>,
  through: ThroughOptions<M>,
  sequelize: Sequelize,
): NormalizedThroughOptions<M> {
  const timestamps = through.timestamps ?? sequelize.options.define?.timestamps;

  let model: ModelStatic<M>;

  if (!through || (typeof through.model !== 'string' && typeof through.model !== 'function')) {
    throw new AssociationError(
      `${source.name}.belongsToMany(${target.name}) requires a through model, set the "through", or "through.model" options to either a string or a model`,
    );
  }

  if (isModelStatic<M>(through.model)) {
    // model class provided directly
    model = through.model;
  } else if (typeof through.model === 'function') {
    // model class provided as a forward reference
    model = through.model(sequelize);
  } else if (sequelize.models.hasByName(through.model)) {
    // model name provided: get if exists, create if not
    model = sequelize.models.getOrThrow<M>(through.model);
  } else {
    const sourceTable = source.table;

    model = sequelize.define(
      through.model,
      {} as ModelAttributes<M>,
      removeUndefined({
        tableName: through.model,
        indexes: [], // we don't want indexes here (as referenced in #2416)
        paranoid: through.paranoid || false, // Default to non-paranoid join (referenced in #11991)
        validate: {}, // Don't propagate model-level validations
        timestamps: through.timestamps,
        schema: sourceTable.schema,
        schemaDelimiter: sourceTable.delimiter,
      }),
    );
  }

  return removeUndefined({
    ...through,
    timestamps,
    model,
  });
}

function normalizeBelongsToManyOptions<
  SourceKey extends string,
  TargetKey extends string,
  ThroughModel extends Model,
>(
  type: AssociationStatic<any>,
  options: BelongsToManyOptions<SourceKey, TargetKey, ThroughModel>,
  source: ModelStatic<Model>,
  target: ModelStatic<Model>,
): NormalizedBelongsToManyOptions<SourceKey, TargetKey, ThroughModel> {
  if ('timestamps' in options) {
    throw new TypeError(
      'The "timestamps" option in belongsToMany has been renamed to through.timestamps',
    );
  }

  if ('uniqueKey' in options) {
    throw new TypeError(
      'The "uniqueKey" option in belongsToMany has been renamed to through.unique',
    );
  }

  const sequelize = target.sequelize;

  return normalizeBaseAssociationOptions(
    type,
    {
      ...options,
      inverse: normalizeInverseAssociation(options.inverse),
      otherKey: normalizeForeignKeyOptions(options.otherKey),
      through: removeUndefined(
        isThroughOptions(options.through)
          ? normalizeThroughOptions(source, target, options.through, sequelize)
          : normalizeThroughOptions(source, target, { model: options.through }, sequelize),
      ),
      throughAssociations: options?.throughAssociations
        ? removeUndefined(options.throughAssociations)
        : EMPTY_OBJECT,
    },
    source,
    target,
  );
}

/**
 * Used for the through table in n:m associations.
 *
 * Used in {@link BelongsToManyOptions.through}
 */
export interface ThroughOptions<ThroughModel extends Model> {
  /**
   * The model used to join both sides of the N:M association.
   * Can be a string if you want the model to be generated by sequelize.
   */
  model: MaybeForwardedModelStatic<ThroughModel> | string;

  /**
   * See {@link ModelOptions.timestamps}
   */
  timestamps?: ModelOptions['timestamps'];

  /**
   * See {@link ModelOptions.paranoid}
   */
  paranoid?: ModelOptions['paranoid'];

  /**
   * A key/value set that will be used for association create and find defaults on the through model.
   * (Remember to add the attributes to the through model)
   */
  scope?: AssociationScope;

  /**
   * If true a unique constraint will be added on the foreign key pair.
   * If set to a string, the generated unique key will use the string as its name.
   * If set to false, no unique constraint will be added.
   * Useful if you want to turn this off and create your own unique constraint when using scopes.
   *
   * This option only works if the model already has a Primary Key,
   * as the unique constraint will not be added if the foreign keys are already part of the composite primary key.
   *
   * @default true
   */
  unique?: boolean | string;
}

/**
 * Attributes for the join table
 */
export interface JoinTableAttributes {
  [attribute: string]: unknown;
}

type NormalizedBelongsToManyOptions<
  SourceKey extends string,
  TargetKey extends string,
  ThroughModel extends Model,
> = Omit<
  RequiredBy<BelongsToManyOptions<SourceKey, TargetKey, ThroughModel>, 'throughAssociations'>,
  'through' | 'as' | 'hooks' | 'foreignKey' | 'inverse'
> & {
  through: NormalizedThroughOptions<ThroughModel>;
  inverse?: Exclude<BelongsToManyOptions<SourceKey, TargetKey, ThroughModel>['inverse'], string>;
} & Pick<NormalizedAssociationOptions<string>, 'as' | 'name' | 'hooks' | 'foreignKey'>;

type NormalizedThroughOptions<ThroughModel extends Model> = Omit<
  ThroughOptions<ThroughModel>,
  'model'
> & {
  model: ModelStatic<ThroughModel>;
};

/**
 * Options provided when associating models with belongsToMany relationship.
 *
 * Used by {@link Model.belongsToMany}.
 */
export interface BelongsToManyOptions<
  SourceKey extends string = string,
  TargetKey extends string = string,
  ThroughModel extends Model = Model,
> extends MultiAssociationOptions<AttributeNames<ThroughModel>> {
  /**
   * The name of the inverse association, or an object for further association setup.
   */
  inverse?:
    | string
    | undefined
    | {
        as?: AssociationOptions<string>['as'];
        scope?: MultiAssociationOptions<string>['scope'];
        foreignKeyConstraints?: AssociationOptions<string>['foreignKeyConstraints'];
      };

  // this is also present in AssociationOptions, but they have different JSDoc, keep both!
  /**
   * Should "ON UPDATE", "ON DELETE" and "REFERENCES" constraints be enabled on the foreign key?
   *
   * This only affects the foreign key that points to the source model.
   * to control the one that points to the target model, set the "foreignKeyConstraints" option in {@link BelongsToManyOptions.inverse}.
   */
  foreignKeyConstraints?: boolean;

  /**
   * The name of the table that is used to join source and target in n:m associations. Can also be a
   * Sequelize model if you want to define the junction table yourself and add extra attributes to it.
   */
  through: MaybeForwardedModelStatic<ThroughModel> | string | ThroughOptions<ThroughModel>;

  /**
   * Configures the name of the associations that will be defined between the source model and the through model,
   * as well as between the target model and the through model.
   */
  throughAssociations?: {
    /**
     * The name of the HasMany association going from the Source model to the Through model.
     *
     * By default, the association will be the name of the BelongsToMany association
     * + the name of the inverse BelongsToMany association.
     */
    fromSource?: string | undefined;

    /**
     * The name of the BelongsTo association going from the Through model to the Source model.
     *
     * By default, the association name will be the name of the inverse BelongsToMany association, singularized.
     */
    toSource?: string | undefined;

    /**
     * The name of the HasMany association going from the Target model to the Through model.
     *
     * By default, the association will be the name of the Inverse BelongsToMany association
     * + the name of the BelongsToMany association.
     */
    fromTarget?: string | undefined;

    /**
     * The name of the BelongsTo association going from the Through model to the Target model.
     *
     * By default, the association name will be the name of the parent BelongsToMany association, singularized.
     */
    toTarget?: string | undefined;
  };

  /**
   * The name of the foreign key attribute in the through model (representing the target model) or an object representing
   * the type definition for the other column (see `Sequelize.define` for syntax). When using an object, you
   * can add a `name` property to set the name of the colum. Defaults to the name of target + primary key of
   * target
   */
  otherKey?: AttributeNames<ThroughModel> | ForeignKeyOptions<AttributeNames<ThroughModel>>;

  /**
   * The name of the attribute to use as the key for the association in the source table.
   * Defaults to the primary key attribute of the source model
   */
  sourceKey?: SourceKey;

  /**
   * The name of the attribute to use as the key for the association in the target table.
   * Defaults to the primary key attribute of the target model
   */
  targetKey?: TargetKey;
}

/**
 * The options for the getAssociations mixin of the belongsToMany association.
 *
 * @see BelongsToManyGetAssociationsMixin
 */
export interface BelongsToManyGetAssociationsMixinOptions<T extends Model>
  extends FindOptions<Attributes<T>> {
  /**
   * A list of the attributes from the join table that you want to select.
   */
  joinTableAttributes?: FindAttributeOptions<Attributes<T>>;
  /**
   * Apply a scope on the related model, or remove its default scope by passing false.
   */
  scope?: string | boolean;

  /**
   * Apply a schema on the related model
   */
  schema?: string;
  schemaDelimiter?: string;

  through?: {
    where?: WhereOptions;
    paranoid?: boolean;
  };
}

/**
 * The getAssociations mixin applied to models with belongsToMany.
 * An example of usage is as follows:
 *
 * ```typescript
 * class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
 *  declare getRoles: BelongsToManyGetAssociationsMixin<Role>;
 * }
 *
 * User.belongsToMany(Role, { through: UserRole });
 * ```
 *
 * @see Model.belongsToMany
 */
export type BelongsToManyGetAssociationsMixin<T extends Model> = (
  options?: BelongsToManyGetAssociationsMixinOptions<T>,
) => Promise<T[]>;

/**
 * The options for the setAssociations mixin of the belongsToMany association.
 *
 * @see BelongsToManySetAssociationsMixin
 */
export interface BelongsToManySetAssociationsMixinOptions<TargetModel extends Model>
  extends FindOptions<Attributes<TargetModel>>,
    BulkCreateOptions<Attributes<TargetModel>>,
    InstanceUpdateOptions<Attributes<TargetModel>>,
    InstanceDestroyOptions {
  /**
   * Additional attributes for the join table.
   */
  through?: JoinTableAttributes;
}

/**
 * The setAssociations mixin applied to models with belongsToMany.
 * An example of usage is as follows:
 *
 * ```typescript
 * class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
 *   declare setRoles: BelongsToManySetAssociationsMixin<Role, Role['id']>;
 * }
 *
 * User.belongsToMany(Role, { through: UserRole });
 * ```
 *
 * @see Model.belongsToMany
 */
export type BelongsToManySetAssociationsMixin<TModel extends Model, TModelPrimaryKey> = (
  newAssociations?: Iterable<TModel | TModelPrimaryKey> | null,
  options?: BelongsToManySetAssociationsMixinOptions<TModel>,
) => Promise<void>;

/**
 * The options for the addAssociations mixin of the belongsToMany association.
 *
 * @see BelongsToManyAddAssociationsMixin
 */
export interface BelongsToManyAddAssociationsMixinOptions<TModel extends Model>
  extends FindOptions<Attributes<TModel>>,
    BulkCreateOptions<Attributes<TModel>>,
    InstanceUpdateOptions<Attributes<TModel>>,
    InstanceDestroyOptions {
  through?: JoinTableAttributes;
}

/**
 * The addAssociations mixin applied to models with belongsToMany.
 * An example of usage is as follows:
 *
 * ```typescript
 * class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
 *   declare addRoles: BelongsToManyAddAssociationsMixin<Role, Role['id']>;
 * }
 *
 * User.belongsToMany(Role, { through: UserRole });
 * ```
 *
 * @see Model.belongsToMany
 */
export type BelongsToManyAddAssociationsMixin<T extends Model, TModelPrimaryKey> = (
  newAssociations?: Iterable<T | TModelPrimaryKey>,
  options?: BelongsToManyAddAssociationsMixinOptions<T>,
) => Promise<void>;

/**
 * The options for the addAssociation mixin of the belongsToMany association.
 *
 * @see BelongsToManyAddAssociationMixin
 */
export interface BelongsToManyAddAssociationMixinOptions<T extends Model>
  extends FindOptions<Attributes<T>>,
    BulkCreateOptions<Attributes<T>>,
    InstanceUpdateOptions<Attributes<T>>,
    InstanceDestroyOptions {
  through?: JoinTableAttributes;
}

/**
 * The addAssociation mixin applied to models with belongsToMany.
 * An example of usage is as follows:
 *
 * ```typescript
 * class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
 *   declare addRole: BelongsToManyAddAssociationMixin<Role, Role['id']>;
 * }
 *
 * User.belongsToMany(Role, { through: UserRole });
 * ```
 *
 * @see Model.belongsToMany
 */
export type BelongsToManyAddAssociationMixin<T extends Model, TModelPrimaryKey> = (
  newAssociation?: T | TModelPrimaryKey,
  options?: BelongsToManyAddAssociationMixinOptions<T>,
) => Promise<void>;

/**
 * The options for the createAssociation mixin of the belongsToMany association.
 *
 * @see BelongsToManyCreateAssociationMixin
 */
export interface BelongsToManyCreateAssociationMixinOptions<T extends Model>
  extends CreateOptions<Attributes<T>> {
  through?: JoinTableAttributes;
}
/**
 * The createAssociation mixin applied to models with belongsToMany.
 * An example of usage is as follows:
 *
 * ```typescript
 * class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
 *   declare createRole: BelongsToManyCreateAssociationMixin<Role>;
 * }
 *
 * User.belongsToMany(Role, { through: UserRole });
 * ```
 *
 * @see Model.belongsToMany
 */
export type BelongsToManyCreateAssociationMixin<T extends Model> = (
  values?: CreationAttributes<T>,
  options?: BelongsToManyCreateAssociationMixinOptions<T>,
) => Promise<T>;

/**
 * The options for the removeAssociation mixin of the belongsToMany association.
 *
 * @see BelongsToManyRemoveAssociationMixin
 */
export interface BelongsToManyRemoveAssociationMixinOptions extends InstanceDestroyOptions {}

/**
 * The removeAssociation mixin applied to models with belongsToMany.
 * An example of usage is as follows:
 *
 * ```typescript
 * class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
 *   declare removeRole: BelongsToManyRemoveAssociationMixin<Role, Role['id']>;
 * }
 *
 * User.belongsToMany(Role, { through: UserRole });
 * ```
 *
 * @see Model.belongsToMany
 */
export type BelongsToManyRemoveAssociationMixin<TModel, TModelPrimaryKey> = (
  oldAssociated?: TModel | TModelPrimaryKey,
  options?: BelongsToManyRemoveAssociationMixinOptions,
) => Promise<void>;

/**
 * The options for the removeAssociations mixin of the belongsToMany association.
 *
 * @see BelongsToManyRemoveAssociationsMixin
 */
export interface BelongsToManyRemoveAssociationsMixinOptions
  extends InstanceDestroyOptions,
    InstanceDestroyOptions {}

/**
 * The removeAssociations mixin applied to models with belongsToMany.
 * An example of usage is as follows:
 *
 * ```typescript
 * class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
 *   declare removeRoles: BelongsToManyRemoveAssociationsMixin<Role, Role['id']>;
 * }
 *
 * User.belongsToMany(Role, { through: UserRole });
 * ```
 *
 * @see Model.belongsToMany
 */
export type BelongsToManyRemoveAssociationsMixin<TModel, TModelPrimaryKey> = (
  associationsToRemove?: Iterable<TModel | TModelPrimaryKey>,
  options?: BelongsToManyRemoveAssociationsMixinOptions,
) => Promise<void>;

/**
 * The options for the hasAssociation mixin of the belongsToMany association.
 *
 * @see BelongsToManyHasAssociationMixin
 */
export interface BelongsToManyHasAssociationMixinOptions<T extends Model>
  extends BelongsToManyGetAssociationsMixinOptions<T> {}

/**
 * The hasAssociation mixin applied to models with belongsToMany.
 * An example of usage is as follows:
 *
 * ```typescript
 * class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
 *   declare hasRole: BelongsToManyHasAssociationMixin<Role, Role['id']>;
 * }
 *
 * User.belongsToMany(Role, { through: UserRole });
 * ```
 *
 * @see Model.belongsToMany
 */
export type BelongsToManyHasAssociationMixin<TModel extends Model, TModelPrimaryKey> = (
  target: TModel | TModelPrimaryKey,
  options?: BelongsToManyHasAssociationMixinOptions<TModel>,
) => Promise<boolean>;

/**
 * The options for the hasAssociations mixin of the belongsToMany association.
 *
 * @see BelongsToManyHasAssociationsMixin
 */
export interface BelongsToManyHasAssociationsMixinOptions<T extends Model>
  extends BelongsToManyGetAssociationsMixinOptions<T> {}

/**
 * The removeAssociations mixin applied to models with belongsToMany.
 * An example of usage is as follows:
 *
 * ```typescript
 * class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
 *   declare hasRoles: BelongsToManyHasAssociationsMixin<Role, Role['id']>;
 * }
 *
 * User.belongsToMany(Role, { through: UserRole });
 * ```
 *
 * @see Model.belongsToMany
 */
export type BelongsToManyHasAssociationsMixin<TModel extends Model, TModelPrimaryKey> = (
  targets: Iterable<TModel | TModelPrimaryKey>,
  options?: BelongsToManyHasAssociationsMixinOptions<TModel>,
) => Promise<boolean>;

/**
 * The options for the countAssociations mixin of the belongsToMany association.
 *
 * @see BelongsToManyCountAssociationsMixin
 */
export interface BelongsToManyCountAssociationsMixinOptions<T extends Model>
  extends Transactionable,
    Filterable<Attributes<T>> {
  /**
   * Apply a scope on the related model, or remove its default scope by passing false.
   */
  scope?: string | boolean;
}

/**
 * The countAssociations mixin applied to models with belongsToMany.
 * An example of usage is as follows:
 *
 * ```typescript
 * class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
 *   declare countRoles: Sequelize.BelongsToManyCountAssociationsMixin;
 * }
 *
 * User.belongsToMany(Role, { through: UserRole });
 * ```
 *
 * @see Model.belongsToMany
 */
export type BelongsToManyCountAssociationsMixin<T extends Model> = (
  options?: BelongsToManyCountAssociationsMixinOptions<T>,
) => Promise<number>;
