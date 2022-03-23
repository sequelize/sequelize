import differenceWith from 'lodash/differenceWith';
import each from 'lodash/each';
import isEqual from 'lodash/eq';
import isObject from 'lodash/isObject';
import isPlainObject from 'lodash/isPlainObject';
import omit from 'lodash/omit';
import pick from 'lodash/pick';
import upperFirst from 'lodash/upperFirst';
import { AssociationError, EmptyResultError } from '../errors';
import type {
  BulkCreateOptions,
  CreateOptions,
  CreationAttributes,
  Filterable,
  FindAttributeOptions,
  FindOptions,
  InstanceDestroyOptions,
  InstanceUpdateOptions,
  Transactionable,
  ModelStatic,
  Model,
  WhereOptions,
  AttributeNames,
  ModelAttributeColumnOptions,
} from '../model';
import { Op } from '../operators';
import type Sequelize from '../sequelize.js';
import type { AllowArray } from '../utils';
import * as Utils from '../utils';
import { isModelStatic } from '../utils';
import { assertAssociationModelIsDefined } from './association-utils.js';
import type { AssociationScope, ForeignKeyOptions, ManyToManyOptions } from './base';
import { Association } from './base';
import type { MultiAssociationAccessors } from './base.js';
import { BelongsTo } from './belongs-to';
import { HasMany } from './has-many';
import { HasOne } from './has-one';
import * as Helpers from './helpers';

// TODO: strictly type mixin options
// TODO: remove empty @return
// TODO: clean jsdoc
// TODO: ensure mixin methods accept CreationAttribute as well
// TODO: compare mixin methods with these methods

/**
 * Many-to-many association with a join table.
 *
 * When the join table has additional attributes, these can be passed in the options object:
 *
 * ```js
 * UserProject = sequelize.define('user_project', {
 *   role: Sequelize.STRING
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
 *
 * See {@link Model.belongsToMany}
 */
export class BelongsToMany<
  S extends Model = Model,
  T extends Model = Model,
  SourceKey extends AttributeNames<S> = any,
  TargetKey extends AttributeNames<T> = any,
> extends Association<S, T, NormalizedBelongsToManyOptions> {
  associationType = 'BelongsToMany';
  isMultiAssociation = true;

  accessors: MultiAssociationAccessors;

  primaryKeyDeleted: boolean;

  otherKey: string;
  otherKeyAttribute: ForeignKeyOptions;
  otherKeyDefault: boolean;

  identifier: string;
  identifierField: string;
  foreignIdentifier: string;
  foreignIdentifierField: string;

  /**
   * The name of the Attribute that the Foreign Key (located on the Through Model) will reference on the Source model.
   */
  sourceKey: SourceKey;

  /**
   * The name of the Column that the Foreign Key (located on the Through Table) will reference on the Source model.
   */
  sourceKeyField: string;

  targetKey: TargetKey;
  targetKeyField: string;
  targetKeyDefault: boolean;

  /**
   *
   */
  pairedWith: BelongsToMany | undefined;

  #intermediaryAssociations: {
    // any is "through" table, which is untyped
    fromSourceToThrough: HasMany<S, any, SourceKey, any>,
    fromThroughToSource: BelongsTo<any, S, any, SourceKey>,
    fromTargetToThrough: HasMany<T, any, TargetKey, any>,
    fromThroughToTarget: BelongsTo<any, T, any, TargetKey>,
  };

  constructor(source: ModelStatic<S>, target: ModelStatic<T>, options: BelongsToManyOptions) {
    if (typeof options.through !== 'string' && !isPlainObject(options.through) && !isModelStatic(options.through)) {
      throw new AssociationError(`${source.name}.belongsToMany(${target.name}) requires through option, pass either a string or a model`);
    }

    assertAssociationModelIsDefined(source);
    assertAssociationModelIsDefined(target);

    const sequelize = source.sequelize!;

    super(source, target, {
      ...options,
      // though is either a string of a Model. Convert it to ThroughOptions.
      through: isThroughOptions(options.through)
        ? normalizeThroughOptions(options.through, sequelize)
        : normalizeThroughOptions({ model: options.through }, sequelize),
    });

    // options.as instead of this.as, because this.as is always set
    if (!options.as && this.isSelfAssociation) {
      throw new AssociationError('\'as\' must be defined for many-to-many self-associations');
    }

    /*
    * Find paired association (if exists)
    */
    each(this.target.associations, association => {
      if (!(association instanceof BelongsToMany)) {
        return;
      }

      if (association.target !== this.source) {
        return;
      }

      if (this.options.through.model === association.options.through.model) {
        if (this.pairedWith && this.pairedWith !== association) {
          throw new Error(`Association ${source.name}.${this.as} is paired with both ${association.source.name}.${association.as} and ${this.pairedWith.source.name}.${this.pairedWith.as}`);
        }

        this.pairedWith = association;
        association.pairedWith = this;
      }
    });

    /*
    * Default/generated source/target keys
    */
    this.sourceKey = this.options.sourceKey || this.source.primaryKeyAttribute;
    this.sourceKeyField = Utils.getColumnName(this.source.rawAttributes[this.sourceKey]);

    if (this.options.targetKey) {
      this.targetKeyDefault = false;
      this.targetKey = this.options.targetKey;
    } else {
      this.targetKeyDefault = true;
      this.targetKey = this.target.primaryKeyAttribute;
    }

    this.targetKeyField = Utils.getColumnName(this.target.getAttributes()[this.targetKey]);

    this._createForeignAndOtherKeys();

    Object.assign(this.options, pick(this.through.model.options, [
      'timestamps', 'createdAt', 'updatedAt', 'deletedAt', 'paranoid',
    ]));

    if (this.pairedWith) {
      let needInjectPaired = false;

      if (this.targetKeyDefault) {
        this.targetKey = this.pairedWith.sourceKey;
        this.targetKeyField = this.pairedWith.sourceKeyField;
        this._createForeignAndOtherKeys();
      }

      if (this.pairedWith.targetKeyDefault // in this case paired.otherKey depends on paired.targetKey,
        // so cleanup previously wrong generated otherKey
        && this.pairedWith.targetKey !== this.sourceKey) {
        delete this.through.model.rawAttributes[this.pairedWith.otherKey];
        this.pairedWith.targetKey = this.sourceKey;
        this.pairedWith.targetKeyField = this.sourceKeyField;
        this.pairedWith._createForeignAndOtherKeys();
        needInjectPaired = true;
      }

      if (this.otherKeyDefault) {
        this.otherKey = this.pairedWith.foreignKey;
      }

      if (this.pairedWith.otherKeyDefault // If paired otherKey was inferred we should make sure to clean it up
        // before adding a new one that matches the foreignKey
        && this.pairedWith.otherKey !== this.foreignKey) {
        delete this.through.model.rawAttributes[this.pairedWith.otherKey];
        this.pairedWith.otherKey = this.foreignKey;
        needInjectPaired = true;
      }

      if (needInjectPaired) {
        this.pairedWith.#injectAttributes();
      }
    }

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

    this.#injectAttributes();
    this.#mixin(source.prototype);
  }

  get sequelize(): Sequelize {
    return this.source.sequelize!;
  }

  get through(): NormalizedThroughOptions {
    return this.options.through;
  }

  get throughModel(): ModelStatic<any> {
    return this.through.model;
  }

  _createForeignAndOtherKeys() {
    /*
    * Default/generated foreign/other keys
    */
    if (isObject(this.options.foreignKey)) {
      this.foreignKeyAttribute = this.options.foreignKey;
      this.foreignKey = this.foreignKeyAttribute.name || this.foreignKeyAttribute.fieldName;
    } else {
      this.foreignKeyAttribute = {};
      this.foreignKey = this.options.foreignKey || Utils.camelize(
        [
          this.source.options.name.singular,
          this.sourceKey,
        ].join('_'),
      );
    }

    if (isObject(this.options.otherKey)) {
      this.otherKeyAttribute = this.options.otherKey;
      this.otherKey = this.otherKeyAttribute.name || this.otherKeyAttribute.fieldName;
    } else {
      if (!this.options.otherKey) {
        this.otherKeyDefault = true;
      }

      this.otherKeyAttribute = {};
      this.otherKey = this.options.otherKey || Utils.camelize(
        [
          this.isSelfAssociation ? Utils.singularize(this.as) : this.target.options.name.singular,
          this.targetKey,
        ].join('_'),
      );
    }
  }

  // the id is in the target table
  // or in an extra table which connects two tables
  #injectAttributes() {
    this.identifier = this.foreignKey;
    this.foreignIdentifier = this.otherKey;

    // remove any PKs previously defined by sequelize
    // but ignore any keys that are part of this association (#5865)
    each(this.through.model.rawAttributes, (attribute, attributeName) => {
      if (attribute.primaryKey === true && attribute._autoGenerated === true) {
        if ([this.foreignKey, this.otherKey].includes(attributeName)) {
          // this key is still needed as it's part of the association
          // so just set primaryKey to false
          attribute.primaryKey = false;
        } else {
          delete this.through.model.rawAttributes[attributeName];
        }

        this.primaryKeyDeleted = true;
      }
    });

    const sourceKey = this.source.rawAttributes[this.sourceKey];
    const sourceKeyType = sourceKey.type;
    const sourceKeyField = this.sourceKeyField;
    const targetKey = this.target.rawAttributes[this.targetKey];
    const targetKeyType = targetKey.type;
    const targetKeyField = this.targetKeyField;
    const sourceAttribute: ModelAttributeColumnOptions = { type: sourceKeyType, ...this.foreignKeyAttribute };
    const targetAttribute: ModelAttributeColumnOptions = { type: targetKeyType, ...this.otherKeyAttribute };

    if (this.primaryKeyDeleted === true) {
      targetAttribute.primaryKey = true;
      sourceAttribute.primaryKey = true;
    } else if (this.through.unique !== false) {
      let uniqueKey;
      if (typeof this.options.uniqueKey === 'string' && this.options.uniqueKey !== '') {
        uniqueKey = this.options.uniqueKey;
      } else {
        uniqueKey = [this.through.model.tableName, this.foreignKey, this.otherKey, 'unique'].join('_');
      }

      targetAttribute.unique = uniqueKey;
      sourceAttribute.unique = uniqueKey;
    }

    if (!this.through.model.rawAttributes[this.foreignKey]) {
      sourceAttribute._autoGenerated = true;
    }

    if (!this.through.model.rawAttributes[this.otherKey]) {
      targetAttribute._autoGenerated = true;
    }

    if (this.options.constraints !== false) {
      sourceAttribute.references = {
        model: this.source.getTableName(),
        key: sourceKeyField,
      };
      // For the source attribute the passed option is the priority
      sourceAttribute.onDelete = this.options.onDelete || this.through.model.rawAttributes[this.foreignKey].onDelete;
      sourceAttribute.onUpdate = this.options.onUpdate || this.through.model.rawAttributes[this.foreignKey].onUpdate;

      if (!sourceAttribute.onDelete) {
        sourceAttribute.onDelete = 'CASCADE';
      }

      if (!sourceAttribute.onUpdate) {
        sourceAttribute.onUpdate = 'CASCADE';
      }

      targetAttribute.references = {
        model: this.target.getTableName(),
        key: targetKeyField,
      };
      // But the for target attribute the previously defined option is the priority (since it could've been set by another belongsToMany call)
      targetAttribute.onDelete = this.through.model.rawAttributes[this.otherKey].onDelete || this.options.onDelete;
      targetAttribute.onUpdate = this.through.model.rawAttributes[this.otherKey].onUpdate || this.options.onUpdate;

      if (!targetAttribute.onDelete) {
        targetAttribute.onDelete = 'CASCADE';
      }

      if (!targetAttribute.onUpdate) {
        targetAttribute.onUpdate = 'CASCADE';
      }
    }

    this.through.model.mergeAttributes({
      [this.foreignKey]: sourceAttribute,
      [this.otherKey]: targetAttribute,
    });

    this.identifierField = Utils.getColumnName(this.through.model.rawAttributes[this.foreignKey]);
    this.foreignIdentifierField = Utils.getColumnName(this.through.model.rawAttributes[this.otherKey]);

    // For Db2 server, a reference column of a FOREIGN KEY must be unique
    // else, server throws SQL0573N error. Hence, setting it here explicitly
    // for non primary columns.
    if (this.sequelize.options.dialect === 'db2' && this.source.getAttributes()[this.sourceKey].primaryKey !== true) {
      // TODO: throw instead!
      this.source.getAttributes()[this.sourceKey].unique = true;
    }

    if (this.pairedWith && !this.pairedWith.foreignIdentifierField) {
      this.pairedWith.foreignIdentifierField = Utils.getColumnName(
        this.through.model.rawAttributes[this.pairedWith.otherKey],
      );
    }

    this.#intermediaryAssociations = {
      fromSourceToThrough: new HasMany(this.source, this.through.model, {
        foreignKey: this.foreignKey,
      }),
      fromThroughToSource: new BelongsTo(this.through.model, this.source, {
        foreignKey: this.foreignKey,
      }),
      fromTargetToThrough: new HasMany(this.target, this.through.model, {
        foreignKey: this.otherKey,
      }),
      fromThroughToTarget: new BelongsTo(this.through.model, this.target, {
        foreignKey: this.otherKey,
      }),
    };

    // this.oneFromSource = new HasOne(this.source, this.through.model, {
    //   foreignKey: this.foreignKey,
    //   sourceKey: this.sourceKey,
    //   as: this.through.model.name,
    // });

    // this.oneFromTarget = new HasOne(this.target, this.through.model, {
    //   foreignKey: this.otherKey,
    //   sourceKey: this.targetKey,
    //   as: this.through.model.name,
    // });

    if (this.pairedWith && this.pairedWith.otherKeyDefault) {
      this.pairedWith.toTarget = new BelongsTo(this.pairedWith.through.model, this.pairedWith.target, {
        foreignKey: this.pairedWith.otherKey,
      });

      this.pairedWith.oneFromTarget = new HasOne(this.pairedWith.target, this.pairedWith.through.model, {
        foreignKey: this.pairedWith.otherKey,
        sourceKey: this.pairedWith.targetKey,
        as: this.pairedWith.through.model.name,
      });
    }

    Helpers.checkNamingCollision(this);

    return this;
  }

  #mixin(modelPrototype: Model) {

    Helpers.mixinMethods(
      this,
      modelPrototype,
      ['get', 'count', 'hasSingle', 'hasAll', 'set', 'add', 'addMultiple', 'remove', 'removeMultiple', 'create'],
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
  async get(instance: S, options?: BelongsToManyGetAssociationsMixinOptions): Promise<T[]> {
    options = Utils.cloneDeep(options) || {};

    const through = this.through;
    let scopeWhere;
    let throughWhere;

    if (this.scope) {
      scopeWhere = { ...this.scope };
    }

    options.where = {
      [Op.and]: [
        scopeWhere,
        options.where,
      ],
    };

    if (Object(through.model) === through.model) {
      throughWhere = {};
      throughWhere[this.foreignKey] = instance.get(this.sourceKey);

      if (through.scope) {
        Object.assign(throughWhere, through.scope);
      }

      // If a user pass a where on the options through options, make an "and" with the current throughWhere
      if (options.through && options.through.where) {
        throughWhere = {
          [Op.and]: [throughWhere, options.through.where],
        };
      }

      options.include = options.include || [];
      options.include.push({
        association: this.oneFromTarget,
        attributes: options.joinTableAttributes,
        required: true,
        paranoid: options.through?.paranoid ?? true,
        where: throughWhere,
      });
    }

    let model = this.target;
    if (Object.prototype.hasOwnProperty.call(options, 'scope')) {
      if (!options.scope) {
        model = model.unscoped();
      } else {
        model = model.scope(options.scope);
      }
    }

    if (Object.prototype.hasOwnProperty.call(options, 'schema')) {
      model = model.schema(options.schema, options.schemaDelimiter);
    }

    return model.findAll(options);
  }

  /**
   * Count everything currently associated with this, using an optional where clause.
   *
   * @param instance instance
   * @param options find options
   */
  async count(instance: S, options?: BelongsToManyCountAssociationsMixinOptions): Promise<number> {
    const sequelize = this.target.sequelize;

    options = Utils.cloneDeep(options);
    options.attributes = [
      [sequelize.fn('COUNT', sequelize.col([this.target.name, this.targetKeyField].join('.'))), 'count'],
    ];
    options.joinTableAttributes = [];
    options.raw = true;
    options.plain = true;

    const result = await this.get(instance, options);

    return Number.parseInt(result.count, 10);
  }

  /**
   * Check if one or more instance(s) are associated with this. If a list of instances is passed, the function returns true if _all_ instances are associated
   *
   * @param sourceInstance source instance to check for an association with
   * @param instances Can be an array of instances or their primary keys
   * @param options Options passed to getAssociations
   */
  async has(
    sourceInstance: S,
    // TODO: type 'unknown', it's the primary key of T
    instances: AllowArray<T | unknown>,
    options?: BelongsToManyHasAssociationMixinOptions,
  ): Promise<boolean> {
    if (!Array.isArray(instances)) {
      instances = [instances];
    }

    options = {
      raw: true,
      ...options,
      scope: false,
      attributes: [this.targetKey],
      joinTableAttributes: [],
    };

    const instancePrimaryKeys = instances.map(instance => {
      if (instance instanceof this.target) {
        return instance.where();
      }

      return {
        [this.targetKey]: instance,
      };
    });

    options.where = {
      [Op.and]: [
        { [Op.or]: instancePrimaryKeys },
        options.where,
      ],
    };

    const associatedObjects = await this.get(sourceInstance, options);

    return differenceWith(instancePrimaryKeys, associatedObjects,
      (a, b) => isEqual(a[this.targetKey], b[this.targetKey])).length === 0;
  }

  /**
   * Set the associated models by passing an array of instances or their primary keys.
   * Everything that it not in the passed array will be un-associated.
   *
   * @param sourceInstance source instance to associate new instances with
   * @param newAssociatedObjects A single instance or primary key, or a mixed array of persisted instances or primary keys
   * @param options Options passed to `through.findAll`, `bulkCreate`, `update` and `destroy`
   */
  async set(
    sourceInstance: S,
    // TODO: type 'unknown', it's the Primary key of T.
    newAssociatedObjects: AllowArray<T | unknown>,
    options?: BelongsToManySetAssociationsMixinOptions,
  ): Promise<void> {
    options = options || {};

    const sourceKey = this.sourceKey;
    const targetKey = this.targetKey;
    const identifier = this.identifier;
    const foreignIdentifier = this.foreignIdentifier;

    if (newAssociatedObjects === null) {
      newAssociatedObjects = [];
    } else {
      newAssociatedObjects = this.toInstanceArray(newAssociatedObjects);
    }

    const where = {
      [identifier]: sourceInstance.get(sourceKey),
      ...this.through.scope,
    };

    const updateAssociations = async currentRows => {
      const obsoleteAssociations = [];
      const promises = [];
      const defaultAttributes = options.through || {};

      const unassociatedObjects = newAssociatedObjects.filter(obj => {
        return !currentRows.some(currentRow => currentRow[foreignIdentifier] === obj.get(targetKey));
      });

      for (const currentRow of currentRows) {
        const newObj = newAssociatedObjects.find(obj => currentRow[foreignIdentifier] === obj.get(targetKey));

        if (!newObj) {
          obsoleteAssociations.push(currentRow);
        } else {
          let throughAttributes = newObj[this.through.model.name];
          // Quick-fix for subtle bug when using existing objects that might have the through model attached (not as an attribute object)
          if (throughAttributes instanceof this.through.model) {
            throughAttributes = {};
          }

          const attributes = { ...defaultAttributes, ...throughAttributes };

          if (Object.keys(attributes).length > 0) {
            promises.push(
              this.through.model.update(attributes, Object.assign(options, {
                where: {
                  [identifier]: sourceInstance.get(sourceKey),
                  [foreignIdentifier]: newObj.get(targetKey),
                },
              })),
            );
          }
        }
      }

      if (obsoleteAssociations.length > 0) {
        promises.push(
          this.through.model.destroy({
            ...options,
            where: {
              [identifier]: sourceInstance.get(sourceKey),
              [foreignIdentifier]: obsoleteAssociations.map(obsoleteAssociation => obsoleteAssociation[foreignIdentifier]),
              ...this.through.scope,
            },
          }),
        );
      }

      if (unassociatedObjects.length > 0) {
        const bulk = unassociatedObjects.map(unassociatedObject => {
          return {
            ...defaultAttributes,
            ...unassociatedObject[this.through.model.name],
            [identifier]: sourceInstance.get(sourceKey),
            [foreignIdentifier]: unassociatedObject.get(targetKey),
            ...this.through.scope,
          };
        });

        promises.push(this.through.model.bulkCreate(bulk, { validate: true, ...options }));
      }

      return Promise.all(promises);
    };

    try {
      const currentRows = await this.through.model.findAll({ ...options, where, raw: true });

      return await updateAssociations(currentRows);
    } catch (error) {
      if (error instanceof EmptyResultError) {
        return updateAssociations([]);
      }

      throw error;
    }
  }

  /**
   * Associate one or several rows with source instance. It will not un-associate any already associated instance
   * that may be missing from `newInstances`.
   *
   * @param sourceInstance source instance to associate new instances with
   * @param newInstances A single instance or primary key, or a mixed array of persisted instances or primary keys
   * @param options Options passed to `through.findAll`, `bulkCreate` and `update`
   */
  async add(
    sourceInstance: S,
    // TODO: type 'unknown', it's the Primary key of T.
    newInstances: AllowArray<T | unknown>,
    options?: BelongsToManyAddAssociationsMixinOptions,
  ): Promise<void> {
    // If newInstances is null or undefined, no-op
    if (!newInstances) {
      return;
    }

    options = { ...options };

    const sourceKey = this.sourceKey;
    const targetKey = this.targetKey;
    const identifier = this.identifier;
    const foreignIdentifier = this.foreignIdentifier;
    const defaultAttributes = options.through || {};

    newInstances = this.toInstanceArray(newInstances);

    const where = {
      [identifier]: sourceInstance.get(sourceKey),
      [foreignIdentifier]: newInstances.map(newInstance => newInstance.get(targetKey)),
      ...this.through.scope,
    };

    const updateAssociations = async currentRows => {
      const promises = [];
      const unassociatedObjects = [];
      const changedAssociations = [];
      for (const obj of newInstances) {
        const existingAssociation = currentRows?.find(current => current[foreignIdentifier] === obj.get(targetKey));

        if (!existingAssociation) {
          unassociatedObjects.push(obj);
        } else {
          const throughAttributes = obj[this.through.model.name];
          const attributes = { ...defaultAttributes, ...throughAttributes };

          if (Object.keys(attributes).some(attribute => attributes[attribute] !== existingAssociation[attribute])) {
            changedAssociations.push(obj);
          }
        }
      }

      if (unassociatedObjects.length > 0) {
        const bulk = unassociatedObjects.map(unassociatedObject => {
          const throughAttributes = unassociatedObject[this.through.model.name];
          const attributes = { ...defaultAttributes, ...throughAttributes };

          attributes[identifier] = sourceInstance.get(sourceKey);
          attributes[foreignIdentifier] = unassociatedObject.get(targetKey);

          Object.assign(attributes, this.through.scope);

          return attributes;
        });

        promises.push(this.through.model.bulkCreate(bulk, { validate: true, ...options }));
      }

      for (const assoc of changedAssociations) {
        let throughAttributes = assoc[this.through.model.name];
        const attributes = { ...defaultAttributes, ...throughAttributes };
        // Quick-fix for subtle bug when using existing objects that might have the through model attached (not as an attribute object)
        if (throughAttributes instanceof this.through.model) {
          throughAttributes = {};
        }

        promises.push(this.through.model.update(attributes, Object.assign(options, {
          where: {
            [identifier]: sourceInstance.get(sourceKey),
            [foreignIdentifier]: assoc.get(targetKey),
          },
        })));
      }

      return Promise.all(promises);
    };

    try {
      const currentRows = await this.through.model.findAll({ ...options, where, raw: true });
      await updateAssociations(currentRows);
    } catch (error) {
      if (error instanceof EmptyResultError) {
        await updateAssociations();

        return;
      }

      throw error;
    }
  }

  /**
   * Un-associate one or more instance(s).
   *
   * @param sourceInstance instance to un associate instances with
   * @param oldAssociatedObjects Can be an Instance or its primary key, or a mixed array of instances and primary keys
   * @param options Options passed to `through.destroy`
   */
  async remove(
    sourceInstance: S,
    // TODO: type 'unknown', it's the Primary key of T.
    oldAssociatedObjects: AllowArray<T | unknown>,
    options?: BelongsToManyRemoveAssociationMixinOptions,
  ): Promise<void> {
    options = options || {};

    oldAssociatedObjects = this.toInstanceArray(oldAssociatedObjects);

    const where = {
      [this.identifier]: sourceInstance.get(this.sourceKey),
      [this.foreignIdentifier]: oldAssociatedObjects.map(newInstance => newInstance.get(this.targetKey)),
    };

    return this.through.model.destroy({ ...options, where });
  }

  /**
   * Create a new instance of the associated model and associate it with this.
   *
   * @param sourceInstance source instance
   * @param values values for target model
   * @param options Options passed to create and add
   */
  async create(
    sourceInstance: S,
    values: CreationAttributes<T>,
    options?: BelongsToManyCreateAssociationMixinOptions,
  ): Promise<T> {
    options = options || {};
    values = values || {};

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

function isThroughOptions(val: any): val is ThroughOptions {
  return isPlainObject(val) && 'model' in val;
}

function normalizeThroughOptions(through: ThroughOptions, sequelize: Sequelize): NormalizedThroughOptions {
  if (isModelStatic(through.model)) {
    return through as NormalizedThroughOptions;
  }

  if (sequelize.isDefined(through.model)) {
    return {
      ...through,
      model: sequelize.model(through.model),
    };
  }

  return {
    ...through,
    model: sequelize.define(through.model, {}, {
      ...this.options,
      tableName: through.model,
      indexes: [], // we don't want indexes here (as referenced in #2416)
      paranoid: through.paranoid || false, // Default to non-paranoid join (referenced in #11991)
      validate: {}, // Don't propagate model-level validations
    }),
  };

}

/**
 * Used for a association table in n:m associations.
 */
export interface ThroughOptions {
  /**
   * The model used to join both sides of the N:M association.
   * Can be a string if you want the model to be generated by sequelize.
   */
  model: ModelStatic<any> | string;

  /**
   * If true the generated join table will be paranoid
   *
   * @default false
   */
  paranoid?: boolean;

  /**
   * A key/value set that will be used for association create and find defaults on the through model.
   * (Remember to add the attributes to the through model)
   */
  scope?: AssociationScope;

  /**
   * If true a unique key will be generated from the foreign keys used (might want to turn this off and create
   * specific unique keys when using scopes)
   *
   * @default true
   */
  unique?: boolean;
}

/**
 * Attributes for the join table
 */
export interface JoinTableAttributes {
  [attribute: string]: unknown;
}

type NormalizedBelongsToManyOptions = Omit<BelongsToManyOptions, 'though'> & {
  through: NormalizedThroughOptions,
};

type NormalizedThroughOptions = Omit<ThroughOptions, 'model'> & {
  model: ModelStatic<any>,
};

/**
 * Options provided when associating models with belongsToMany relationship
 */
export interface BelongsToManyOptions extends ManyToManyOptions {
  /**
   * The name of the table that is used to join source and target in n:m associations. Can also be a
   * sequelize model if you want to define the junction table yourself and add extra attributes to it.
   */
  through: ModelStatic<any> | string | ThroughOptions;

  /**
   * The name of the foreign key in the join table (representing the target model) or an object representing
   * the type definition for the other column (see `Sequelize.define` for syntax). When using an object, you
   * can add a `name` property to set the name of the colum. Defaults to the name of target + primary key of
   * target
   */
  otherKey?: string | ForeignKeyOptions;

  /**
   * The name of the field to use as the key for the association in the source table. Defaults to the primary
   * key of the source table
   */
  sourceKey?: string;

  /**
   * The name of the field to use as the key for the association in the target table. Defaults to the primary
   * key of the target table
   */
  targetKey?: string;

  /**
   * Should the join model have timestamps
   */
  timestamps?: boolean;

  /**
   * The unique key name to override the autogenerated one when primary key is not present on through model
   */
  uniqueKey?: string;
}

/**
 * The options for the getAssociations mixin of the belongsToMany association.
 *
 * @see BelongsToManyGetAssociationsMixin
 */
export interface BelongsToManyGetAssociationsMixinOptions extends FindOptions<any> {
  /**
   * A list of the attributes from the join table that you want to select.
   */
  joinTableAttributes?: FindAttributeOptions;
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
    where?: WhereOptions,
    paranoid?: boolean,
  };
}

/**
 * The getAssociations mixin applied to models with belongsToMany.
 * An example of usage is as follows:
 *
 * ```js
 *
 * User.belongsToMany(Role, { through: UserRole });
 *
 * interface UserInstance extends Sequelize.Instance<UserInstance, UserAttributes>, UserAttributes {
 *  getRoles: Sequelize.BelongsToManyGetAssociationsMixin<RoleInstance>;
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
 * @see https://sequelize.org/master/class/lib/associations/belongs-to-many.js~BelongsToMany.html
 * @see Instance
 */
export type BelongsToManyGetAssociationsMixin<TModel> = (
  options?: BelongsToManyGetAssociationsMixinOptions
) => Promise<TModel[]>;

/**
 * The options for the setAssociations mixin of the belongsToMany association.
 *
 * @see BelongsToManySetAssociationsMixin
 */
export interface BelongsToManySetAssociationsMixinOptions
  extends FindOptions<any>,
    BulkCreateOptions<any>,
    InstanceUpdateOptions<any>,
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
 * ```js
 *
 * User.belongsToMany(Role, { through: UserRole });
 *
 * interface UserInstance extends Sequelize.Instance<UserInstance, UserAttributes>, UserAttributes {
 *  // getRoles...
 *  setRoles: Sequelize.BelongsToManySetAssociationsMixin<RoleInstance, RoleId, UserRoleAttributes>;
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
 * @see https://sequelize.org/master/class/lib/associations/belongs-to-many.js~BelongsToMany.html
 * @see Instance
 */
export type BelongsToManySetAssociationsMixin<TModel, TModelPrimaryKey> = (
  newAssociations?: Array<TModel | TModelPrimaryKey>,
  options?: BelongsToManySetAssociationsMixinOptions
) => Promise<void>;

/**
 * The options for the addAssociations mixin of the belongsToMany association.
 *
 * @see BelongsToManyAddAssociationsMixin
 */
export interface BelongsToManyAddAssociationsMixinOptions
  extends FindOptions<any>,
    BulkCreateOptions<any>,
    InstanceUpdateOptions<any>,
    InstanceDestroyOptions {
  through?: JoinTableAttributes;
}

/**
 * The addAssociations mixin applied to models with belongsToMany.
 * An example of usage is as follows:
 *
 * ```js
 *
 * User.belongsToMany(Role, { through: UserRole });
 *
 * interface UserInstance extends Sequelize.Instance<UserInstance, UserAttributes>, UserAttributes {
 *  // getRoles...
 *  // setRoles...
 *  addRoles: Sequelize.BelongsToManyAddAssociationsMixin<RoleInstance, RoleId, UserRoleAttributes>;
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
 * @see https://sequelize.org/master/class/lib/associations/belongs-to-many.js~BelongsToMany.html
 * @see Instance
 */
export type BelongsToManyAddAssociationsMixin<TModel, TModelPrimaryKey> = (
  newAssociations?: Array<TModel | TModelPrimaryKey>,
  options?: BelongsToManyAddAssociationsMixinOptions
) => Promise<void>;

/**
 * The options for the addAssociation mixin of the belongsToMany association.
 *
 * @see BelongsToManyAddAssociationMixin
 */
export interface BelongsToManyAddAssociationMixinOptions
  extends FindOptions<any>,
    BulkCreateOptions<any>,
    InstanceUpdateOptions<any>,
    InstanceDestroyOptions {
  through?: JoinTableAttributes;
}

/**
 * The addAssociation mixin applied to models with belongsToMany.
 * An example of usage is as follows:
 *
 * ```js
 *
 * User.belongsToMany(Role, { through: UserRole });
 *
 * interface UserInstance extends Sequelize.Instance<UserInstance, UserAttributes>, UserAttributes {
 *  // getRoles...
 *  // setRoles...
 *  // addRoles...
 *  addRole: Sequelize.BelongsToManyAddAssociationMixin<RoleInstance, RoleId, UserRoleAttributes>;
 *  // createRole...
 *  // removeRole...
 *  // removeRoles...
 *  // hasRole...
 *  // hasRoles...
 *  // countRoles...
 * }
 * ```
 *
 * @see https://sequelize.org/master/class/lib/associations/belongs-to-many.js~BelongsToMany.html
 * @see Instance
 */
export type BelongsToManyAddAssociationMixin<TModel, TModelPrimaryKey> = (
  newAssociation?: TModel | TModelPrimaryKey,
  options?: BelongsToManyAddAssociationMixinOptions
) => Promise<void>;

/**
 * The options for the createAssociation mixin of the belongsToMany association.
 *
 * @see BelongsToManyCreateAssociationMixin
 */
export interface BelongsToManyCreateAssociationMixinOptions extends CreateOptions<any> {
  through?: JoinTableAttributes;
}
/**
 * The createAssociation mixin applied to models with belongsToMany.
 * An example of usage is as follows:
 *
 * ```js
 *
 * User.belongsToMany(Role, { through: UserRole });
 *
 * interface UserInstance extends Sequelize.Instance<UserInstance, UserAttributes>, UserAttributes {
 *  // getRoles...
 *  // setRoles...
 *  // addRoles...
 *  // addRole...
 *  createRole: Sequelize.BelongsToManyCreateAssociationMixin<RoleAttributes, UserRoleAttributes>;
 *  // removeRole...
 *  // removeRoles...
 *  // hasRole...
 *  // hasRoles...
 *  // countRoles...
 * }
 * ```
 *
 * @see https://sequelize.org/master/class/lib/associations/belongs-to-many.js~BelongsToMany.html
 * @see Instance
 */
export type BelongsToManyCreateAssociationMixin<TModel extends Model> = (
  values?: CreationAttributes<TModel>,
  options?: BelongsToManyCreateAssociationMixinOptions
) => Promise<TModel>;

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
 * ```js
 *
 * User.belongsToMany(Role, { through: UserRole });
 *
 * interface UserInstance extends Sequelize.Instance<UserInstance, UserAttributes>, UserAttributes {
 *  // getRoles...
 *  // setRoles...
 *  // addRoles...
 *  // addRole...
 *  // createRole...
 *  removeRole: Sequelize.BelongsToManyRemoveAssociationMixin<RoleInstance, RoleId>;
 *  // removeRoles...
 *  // hasRole...
 *  // hasRoles...
 *  // countRoles...
 * }
 * ```
 *
 * @see https://sequelize.org/master/class/lib/associations/belongs-to-many.js~BelongsToMany.html
 * @see Instance
 */
export type BelongsToManyRemoveAssociationMixin<TModel, TModelPrimaryKey> = (
  oldAssociated?: TModel | TModelPrimaryKey,
  options?: BelongsToManyRemoveAssociationMixinOptions
) => Promise<void>;

/**
 * The options for the removeAssociations mixin of the belongsToMany association.
 *
 * @see BelongsToManyRemoveAssociationsMixin
 */
export interface BelongsToManyRemoveAssociationsMixinOptions extends InstanceDestroyOptions, InstanceDestroyOptions {}

/**
 * The removeAssociations mixin applied to models with belongsToMany.
 * An example of usage is as follows:
 *
 * ```js
 *
 * User.belongsToMany(Role, { through: UserRole });
 *
 * interface UserInstance extends Sequelize.Instance<UserInstance, UserAttributes>, UserAttributes {
 *  // getRoles...
 *  // setRoles...
 *  // addRoles...
 *  // addRole...
 *  // createRole...
 *  // removeRole...
 *  removeRoles: Sequelize.BelongsToManyRemoveAssociationsMixin<RoleInstance, RoleId>;
 *  // hasRole...
 *  // hasRoles...
 *  // countRoles...
 * }
 * ```
 *
 * @see https://sequelize.org/master/class/lib/associations/belongs-to-many.js~BelongsToMany.html
 * @see Instance
 */
export type BelongsToManyRemoveAssociationsMixin<TModel, TModelPrimaryKey> = (
  oldAssociateds?: Array<TModel | TModelPrimaryKey>,
  options?: BelongsToManyRemoveAssociationsMixinOptions
) => Promise<void>;

/**
 * The options for the hasAssociation mixin of the belongsToMany association.
 *
 * @see BelongsToManyHasAssociationMixin
 */
export interface BelongsToManyHasAssociationMixinOptions extends BelongsToManyGetAssociationsMixinOptions {}

/**
 * The hasAssociation mixin applied to models with belongsToMany.
 * An example of usage is as follows:
 *
 * ```js
 *
 * User.belongsToMany(Role, { through: UserRole });
 *
 * interface UserInstance extends Sequelize.Instance<UserInstance, UserAttributes>, UserAttributes {
 *  // getRoles...
 *  // setRoles...
 *  // addRoles...
 *  // addRole...
 *  // createRole...
 *  // removeRole...
 *  // removeRoles...
 *  hasRole: Sequelize.BelongsToManyHasAssociationMixin<RoleInstance, RoleId>;
 *  // hasRoles...
 *  // countRoles...
 * }
 * ```
 *
 * @see https://sequelize.org/master/class/lib/associations/belongs-to-many.js~BelongsToMany.html
 * @see Instance
 */
export type BelongsToManyHasAssociationMixin<TModel, TModelPrimaryKey> = (
  target: TModel | TModelPrimaryKey,
  options?: BelongsToManyHasAssociationMixinOptions
) => Promise<boolean>;

/**
 * The options for the hasAssociations mixin of the belongsToMany association.
 *
 * @see BelongsToManyHasAssociationsMixin
 */
export interface BelongsToManyHasAssociationsMixinOptions extends BelongsToManyGetAssociationsMixinOptions {}

/**
 * The removeAssociations mixin applied to models with belongsToMany.
 * An example of usage is as follows:
 *
 * ```js
 *
 * User.belongsToMany(Role, { through: UserRole });
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
 *  hasRoles: Sequelize.BelongsToManyHasAssociationsMixin<RoleInstance, RoleId>;
 *  // countRoles...
 * }
 * ```
 *
 * @see https://sequelize.org/master/class/lib/associations/belongs-to-many.js~BelongsToMany.html
 * @see Instance
 */
export type BelongsToManyHasAssociationsMixin<TModel, TModelPrimaryKey> = (
  targets: Array<TModel | TModelPrimaryKey>,
  options?: BelongsToManyHasAssociationsMixinOptions
) => Promise<boolean>;

/**
 * The options for the countAssociations mixin of the belongsToMany association.
 *
 * @see BelongsToManyCountAssociationsMixin
 */
export interface BelongsToManyCountAssociationsMixinOptions extends Transactionable, Filterable<any> {
  /**
   * Apply a scope on the related model, or remove its default scope by passing false.
   */
  scope?: string | boolean;
}

/**
 * The countAssociations mixin applied to models with belongsToMany.
 * An example of usage is as follows:
 *
 * ```js
 *
 * User.belongsToMany(Role, { through: UserRole });
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
 *  countRoles: Sequelize.BelongsToManyCountAssociationsMixin;
 * }
 * ```
 *
 * @see https://sequelize.org/master/class/lib/associations/belongs-to-many.js~BelongsToMany.html
 * @see Instance
 */
export type BelongsToManyCountAssociationsMixin = (
  options?: BelongsToManyCountAssociationsMixinOptions
) => Promise<number>;
