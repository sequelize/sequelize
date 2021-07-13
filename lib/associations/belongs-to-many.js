'use strict';

const Utils = require('./../utils');
const Helpers = require('./helpers');
const _ = require('lodash');
const Association = require('./base');
const BelongsTo = require('./belongs-to');
const HasMany = require('./has-many');
const HasOne = require('./has-one');
const AssociationError = require('../errors').AssociationError;
const EmptyResultError = require('../errors').EmptyResultError;
const Op = require('../operators');

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
 * @see {@link Model.belongsToMany}
 */
class BelongsToMany extends Association {
  constructor(source, target, options) {
    super(source, target, options);

    if (this.options.through === undefined || this.options.through === true || this.options.through === null) {
      throw new AssociationError(`${source.name}.belongsToMany(${target.name}) requires through option, pass either a string or a model`);
    }

    if (!this.options.through.model) {
      this.options.through = {
        model: options.through
      };
    }

    this.associationType = 'BelongsToMany';
    this.targetAssociation = null;
    this.sequelize = source.sequelize;
    this.through = { ...this.options.through };
    this.isMultiAssociation = true;
    this.doubleLinked = false;

    if (!this.as && this.isSelfAssociation) {
      throw new AssociationError('\'as\' must be defined for many-to-many self-associations');
    }

    if (this.as) {
      this.isAliased = true;

      if (_.isPlainObject(this.as)) {
        this.options.name = this.as;
        this.as = this.as.plural;
      } else {
        this.options.name = {
          plural: this.as,
          singular: Utils.singularize(this.as)
        };
      }
    } else {
      this.as = this.target.options.name.plural;
      this.options.name = this.target.options.name;
    }

    this.combinedTableName = Utils.combineTableNames(
      this.source.tableName,
      this.isSelfAssociation ? this.as || this.target.tableName : this.target.tableName
    );

    /*
    * If self association, this is the target association - Unless we find a pairing association
    */
    if (this.isSelfAssociation) {
      this.targetAssociation = this;
    }

    /*
    * Find paired association (if exists)
    */
    _.each(this.target.associations, association => {
      if (association.associationType !== 'BelongsToMany') return;
      if (association.target !== this.source) return;

      if (this.options.through.model === association.options.through.model) {
        this.paired = association;
        association.paired = this;
      }
    });

    /*
    * Default/generated source/target keys
    */
    this.sourceKey = this.options.sourceKey || this.source.primaryKeyAttribute;
    this.sourceKeyField = this.source.rawAttributes[this.sourceKey].field || this.sourceKey;

    if (this.options.targetKey) {
      this.targetKey = this.options.targetKey;
      this.targetKeyField = this.target.rawAttributes[this.targetKey].field || this.targetKey;
    } else {
      this.targetKeyDefault = true;
      this.targetKey = this.target.primaryKeyAttribute;
      this.targetKeyField = this.target.rawAttributes[this.targetKey].field || this.targetKey;
    }

    this._createForeignAndOtherKeys();

    if (typeof this.through.model === 'string') {
      if (!this.sequelize.isDefined(this.through.model)) {
        this.through.model = this.sequelize.define(this.through.model, {}, Object.assign(this.options, {
          tableName: this.through.model,
          indexes: [], //we don't want indexes here (as referenced in #2416)
          paranoid: this.through.paranoid ? this.through.paranoid : false, // Default to non-paranoid join (referenced in #11991)
          validate: {} // Don't propagate model-level validations
        }));
      } else {
        this.through.model = this.sequelize.model(this.through.model);
      }
    }

    Object.assign(this.options, _.pick(this.through.model.options, [
      'timestamps', 'createdAt', 'updatedAt', 'deletedAt', 'paranoid'
    ]));

    if (this.paired) {
      let needInjectPaired = false;

      if (this.targetKeyDefault) {
        this.targetKey = this.paired.sourceKey;
        this.targetKeyField = this.paired.sourceKeyField;
        this._createForeignAndOtherKeys();
      }
      if (this.paired.targetKeyDefault) {
        // in this case paired.otherKey depends on paired.targetKey,
        // so cleanup previously wrong generated otherKey
        if (this.paired.targetKey !== this.sourceKey) {
          delete this.through.model.rawAttributes[this.paired.otherKey];
          this.paired.targetKey = this.sourceKey;
          this.paired.targetKeyField = this.sourceKeyField;
          this.paired._createForeignAndOtherKeys();
          needInjectPaired = true;
        }
      }

      if (this.otherKeyDefault) {
        this.otherKey = this.paired.foreignKey;
      }
      if (this.paired.otherKeyDefault) {
        // If paired otherKey was inferred we should make sure to clean it up
        // before adding a new one that matches the foreignKey
        if (this.paired.otherKey !== this.foreignKey) {
          delete this.through.model.rawAttributes[this.paired.otherKey];
          this.paired.otherKey = this.foreignKey;
          needInjectPaired = true;
        }
      }

      if (needInjectPaired) {
        this.paired._injectAttributes();
      }
    }

    if (this.through) {
      this.throughModel = this.through.model;
    }

    this.options.tableName = this.combinedName = this.through.model === Object(this.through.model) ? this.through.model.tableName : this.through.model;

    this.associationAccessor = this.as;

    // Get singular and plural names, trying to uppercase the first letter, unless the model forbids it
    const plural = _.upperFirst(this.options.name.plural);
    const singular = _.upperFirst(this.options.name.singular);

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
      count: `count${plural}`
    };
  }

  _createForeignAndOtherKeys() {
    /*
    * Default/generated foreign/other keys
    */
    if (_.isObject(this.options.foreignKey)) {
      this.foreignKeyAttribute = this.options.foreignKey;
      this.foreignKey = this.foreignKeyAttribute.name || this.foreignKeyAttribute.fieldName;
    } else {
      this.foreignKeyAttribute = {};
      this.foreignKey = this.options.foreignKey || Utils.camelize(
        [
          this.source.options.name.singular,
          this.sourceKey
        ].join('_')
      );
    }

    if (_.isObject(this.options.otherKey)) {
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
          this.targetKey
        ].join('_')
      );
    }
  }

  // the id is in the target table
  // or in an extra table which connects two tables
  _injectAttributes() {
    this.identifier = this.foreignKey;
    this.foreignIdentifier = this.otherKey;

    // remove any PKs previously defined by sequelize
    // but ignore any keys that are part of this association (#5865)
    _.each(this.through.model.rawAttributes, (attribute, attributeName) => {
      if (attribute.primaryKey === true && attribute._autoGenerated === true) {
        if (attributeName === this.foreignKey || attributeName === this.otherKey) {
          // this key is still needed as it's part of the association
          // so just set primaryKey to false
          attribute.primaryKey = false;
        }
        else {
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
    const sourceAttribute = { type: sourceKeyType, ...this.foreignKeyAttribute };
    const targetAttribute = { type: targetKeyType, ...this.otherKeyAttribute };

    if (this.primaryKeyDeleted === true) {
      targetAttribute.primaryKey = sourceAttribute.primaryKey = true;
    } else if (this.through.unique !== false) {
      let uniqueKey;
      if (typeof this.options.uniqueKey === 'string' && this.options.uniqueKey !== '') {
        uniqueKey = this.options.uniqueKey;
      } else {
        uniqueKey = [this.through.model.tableName, this.foreignKey, this.otherKey, 'unique'].join('_');
      }
      targetAttribute.unique = sourceAttribute.unique = uniqueKey;
    }

    if (!this.through.model.rawAttributes[this.foreignKey]) {
      this.through.model.rawAttributes[this.foreignKey] = {
        _autoGenerated: true
      };
    }

    if (!this.through.model.rawAttributes[this.otherKey]) {
      this.through.model.rawAttributes[this.otherKey] = {
        _autoGenerated: true
      };
    }

    if (this.options.constraints !== false) {
      sourceAttribute.references = {
        model: this.source.getTableName(),
        key: sourceKeyField
      };
      // For the source attribute the passed option is the priority
      sourceAttribute.onDelete = this.options.onDelete || this.through.model.rawAttributes[this.foreignKey].onDelete;
      sourceAttribute.onUpdate = this.options.onUpdate || this.through.model.rawAttributes[this.foreignKey].onUpdate;

      if (!sourceAttribute.onDelete) sourceAttribute.onDelete = 'CASCADE';
      if (!sourceAttribute.onUpdate) sourceAttribute.onUpdate = 'CASCADE';

      targetAttribute.references = {
        model: this.target.getTableName(),
        key: targetKeyField
      };
      // But the for target attribute the previously defined option is the priority (since it could've been set by another belongsToMany call)
      targetAttribute.onDelete = this.through.model.rawAttributes[this.otherKey].onDelete || this.options.onDelete;
      targetAttribute.onUpdate = this.through.model.rawAttributes[this.otherKey].onUpdate || this.options.onUpdate;

      if (!targetAttribute.onDelete) targetAttribute.onDelete = 'CASCADE';
      if (!targetAttribute.onUpdate) targetAttribute.onUpdate = 'CASCADE';
    }

    Object.assign(this.through.model.rawAttributes[this.foreignKey], sourceAttribute);
    Object.assign(this.through.model.rawAttributes[this.otherKey], targetAttribute);

    this.through.model.refreshAttributes();

    this.identifierField = this.through.model.rawAttributes[this.foreignKey].field || this.foreignKey;
    this.foreignIdentifierField = this.through.model.rawAttributes[this.otherKey].field || this.otherKey;

    if (this.paired && !this.paired.foreignIdentifierField) {
      this.paired.foreignIdentifierField = this.through.model.rawAttributes[this.paired.otherKey].field || this.paired.otherKey;
    }

    this.toSource = new BelongsTo(this.through.model, this.source, {
      foreignKey: this.foreignKey
    });
    this.manyFromSource = new HasMany(this.source, this.through.model, {
      foreignKey: this.foreignKey
    });
    this.oneFromSource = new HasOne(this.source, this.through.model, {
      foreignKey: this.foreignKey,
      sourceKey: this.sourceKey,
      as: this.through.model.name
    });

    this.toTarget = new BelongsTo(this.through.model, this.target, {
      foreignKey: this.otherKey
    });
    this.manyFromTarget = new HasMany(this.target, this.through.model, {
      foreignKey: this.otherKey
    });
    this.oneFromTarget = new HasOne(this.target, this.through.model, {
      foreignKey: this.otherKey,
      sourceKey: this.targetKey,
      as: this.through.model.name
    });

    if (this.paired && this.paired.otherKeyDefault) {
      this.paired.toTarget = new BelongsTo(this.paired.through.model, this.paired.target, {
        foreignKey: this.paired.otherKey
      });

      this.paired.oneFromTarget = new HasOne(this.paired.target, this.paired.through.model, {
        foreignKey: this.paired.otherKey,
        sourceKey: this.paired.targetKey,
        as: this.paired.through.model.name
      });
    }

    Helpers.checkNamingCollision(this);

    return this;
  }

  mixin(obj) {
    const methods = ['get', 'count', 'hasSingle', 'hasAll', 'set', 'add', 'addMultiple', 'remove', 'removeMultiple', 'create'];
    const aliases = {
      hasSingle: 'has',
      hasAll: 'has',
      addMultiple: 'add',
      removeMultiple: 'remove'
    };

    Helpers.mixinMethods(this, obj, methods, aliases);
  }

  /**
   * Get everything currently associated with this, using an optional where clause.
   *
   * @see
   * {@link Model} for a full explanation of options
   *
   * @param {Model} instance instance
   * @param {object} [options] find options
   * @param {object} [options.where] An optional where clause to limit the associated models
   * @param {string|boolean} [options.scope] Apply a scope on the related model, or remove its default scope by passing false
   * @param {string} [options.schema] Apply a schema on the related model
   * @param {object} [options.through.where] An optional where clause applied to through model (join table)
   * @param {boolean} [options.through.paranoid=true] If true, only non-deleted records will be returned from the join table. If false, both deleted and non-deleted records will be returned. Only applies if through model is paranoid
   *
   * @returns {Promise<Array<Model>>}
   */
  async get(instance, options) {
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
        options.where
      ]
    };

    if (Object(through.model) === through.model) {
      throughWhere = {};
      throughWhere[this.foreignKey] = instance.get(this.sourceKey);

      if (through.scope) {
        Object.assign(throughWhere, through.scope);
      }

      //If a user pass a where on the options through options, make an "and" with the current throughWhere
      if (options.through && options.through.where) {
        throughWhere = {
          [Op.and]: [throughWhere, options.through.where]
        };
      }

      options.include = options.include || [];
      options.include.push({
        association: this.oneFromTarget,
        attributes: options.joinTableAttributes,
        required: true,
        paranoid: _.get(options.through, 'paranoid', true),
        where: throughWhere
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
   * @param {Model} instance instance
   * @param {object} [options] find options
   * @param {object} [options.where] An optional where clause to limit the associated models
   * @param {string|boolean} [options.scope] Apply a scope on the related model, or remove its default scope by passing false
   *
   * @returns {Promise<number>}
   */
  async count(instance, options) {
    const sequelize = this.target.sequelize;

    options = Utils.cloneDeep(options);
    options.attributes = [
      [sequelize.fn('COUNT', sequelize.col([this.target.name, this.targetKeyField].join('.'))), 'count']
    ];
    options.joinTableAttributes = [];
    options.raw = true;
    options.plain = true;

    const result = await this.get(instance, options);

    return parseInt(result.count, 10);
  }

  /**
   * Check if one or more instance(s) are associated with this. If a list of instances is passed, the function returns true if _all_ instances are associated
   *
   * @param {Model} sourceInstance source instance to check for an association with
   * @param {Model|Model[]|string[]|string|number[]|number} [instances] Can be an array of instances or their primary keys
   * @param {object} [options] Options passed to getAssociations
   *
   * @returns {Promise<boolean>}
   */
  async has(sourceInstance, instances, options) {
    if (!Array.isArray(instances)) {
      instances = [instances];
    }

    options = {
      raw: true,
      ...options,
      scope: false,
      attributes: [this.targetKey],
      joinTableAttributes: []
    };

    const instancePrimaryKeys = instances.map(instance => {
      if (instance instanceof this.target) {
        return instance.where();
      }
      return {
        [this.targetKey]: instance
      };
    });

    options.where = {
      [Op.and]: [
        { [Op.or]: instancePrimaryKeys },
        options.where
      ]
    };

    const associatedObjects = await this.get(sourceInstance, options);

    return _.differenceWith(instancePrimaryKeys, associatedObjects,
      (a, b) => _.isEqual(a[this.targetKey], b[this.targetKey])).length === 0;
  }

  /**
   * Set the associated models by passing an array of instances or their primary keys.
   * Everything that it not in the passed array will be un-associated.
   *
   * @param {Model} sourceInstance source instance to associate new instances with
   * @param {Model|Model[]|string[]|string|number[]|number} [newAssociatedObjects] A single instance or primary key, or a mixed array of persisted instances or primary keys
   * @param {object} [options] Options passed to `through.findAll`, `bulkCreate`, `update` and `destroy`
   * @param {object} [options.validate] Run validation for the join model
   * @param {object} [options.through] Additional attributes for the join table.
   *
   * @returns {Promise}
   */
  async set(sourceInstance, newAssociatedObjects, options) {
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
      ...this.through.scope
    };

    const updateAssociations = currentRows => {
      const obsoleteAssociations = [];
      const promises = [];
      const defaultAttributes = options.through || {};

      const unassociatedObjects = newAssociatedObjects.filter(obj =>
        !currentRows.some(currentRow => currentRow[foreignIdentifier] === obj.get(targetKey))
      );

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

          if (Object.keys(attributes).length) {
            promises.push(
              this.through.model.update(attributes, Object.assign(options, {
                where: {
                  [identifier]: sourceInstance.get(sourceKey),
                  [foreignIdentifier]: newObj.get(targetKey)
                }
              }
              ))
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
              ...this.through.scope
            }
          })
        );
      }

      if (unassociatedObjects.length > 0) {
        const bulk = unassociatedObjects.map(unassociatedObject => {
          return {
            ...defaultAttributes,
            ...unassociatedObject[this.through.model.name],
            [identifier]: sourceInstance.get(sourceKey),
            [foreignIdentifier]: unassociatedObject.get(targetKey),
            ...this.through.scope
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
      if (error instanceof EmptyResultError) return updateAssociations([]);
      throw error;
    }
  }

  /**
   * Associate one or several rows with source instance. It will not un-associate any already associated instance
   * that may be missing from `newInstances`.
   *
   * @param {Model} sourceInstance source instance to associate new instances with
   * @param {Model|Model[]|string[]|string|number[]|number} [newInstances] A single instance or primary key, or a mixed array of persisted instances or primary keys
   * @param {object} [options] Options passed to `through.findAll`, `bulkCreate` and `update`
   * @param {object} [options.validate] Run validation for the join model.
   * @param {object} [options.through] Additional attributes for the join table.
   *
   * @returns {Promise}
   */
  async add(sourceInstance, newInstances, options) {
    // If newInstances is null or undefined, no-op
    if (!newInstances) return Promise.resolve();

    options = { ...options };

    const association = this;
    const sourceKey = association.sourceKey;
    const targetKey = association.targetKey;
    const identifier = association.identifier;
    const foreignIdentifier = association.foreignIdentifier;
    const defaultAttributes = options.through || {};

    newInstances = association.toInstanceArray(newInstances);

    const where = {
      [identifier]: sourceInstance.get(sourceKey),
      [foreignIdentifier]: newInstances.map(newInstance => newInstance.get(targetKey)),
      ...association.through.scope
    };

    const updateAssociations = currentRows => {
      const promises = [];
      const unassociatedObjects = [];
      const changedAssociations = [];
      for (const obj of newInstances) {
        const existingAssociation = currentRows && currentRows.find(current => current[foreignIdentifier] === obj.get(targetKey));

        if (!existingAssociation) {
          unassociatedObjects.push(obj);
        } else {
          const throughAttributes = obj[association.through.model.name];
          const attributes = { ...defaultAttributes, ...throughAttributes };

          if (Object.keys(attributes).some(attribute => attributes[attribute] !== existingAssociation[attribute])) {
            changedAssociations.push(obj);
          }
        }
      }

      if (unassociatedObjects.length > 0) {
        const bulk = unassociatedObjects.map(unassociatedObject => {
          const throughAttributes = unassociatedObject[association.through.model.name];
          const attributes = { ...defaultAttributes, ...throughAttributes };

          attributes[identifier] = sourceInstance.get(sourceKey);
          attributes[foreignIdentifier] = unassociatedObject.get(targetKey);

          Object.assign(attributes, association.through.scope);

          return attributes;
        });

        promises.push(association.through.model.bulkCreate(bulk, { validate: true, ...options }));
      }

      for (const assoc of changedAssociations) {
        let throughAttributes = assoc[association.through.model.name];
        const attributes = { ...defaultAttributes, ...throughAttributes };
        // Quick-fix for subtle bug when using existing objects that might have the through model attached (not as an attribute object)
        if (throughAttributes instanceof association.through.model) {
          throughAttributes = {};
        }

        promises.push(association.through.model.update(attributes, Object.assign(options, { where: {
          [identifier]: sourceInstance.get(sourceKey),
          [foreignIdentifier]: assoc.get(targetKey)
        } })));
      }

      return Promise.all(promises);
    };

    try {
      const currentRows = await association.through.model.findAll({ ...options, where, raw: true });
      const [associations] = await updateAssociations(currentRows);
      return associations;
    } catch (error) {
      if (error instanceof EmptyResultError) return updateAssociations();
      throw error;
    }
  }

  /**
   * Un-associate one or more instance(s).
   *
   * @param {Model} sourceInstance instance to un associate instances with
   * @param {Model|Model[]|string|string[]|number|number[]} [oldAssociatedObjects] Can be an Instance or its primary key, or a mixed array of instances and primary keys
   * @param {object} [options] Options passed to `through.destroy`
   *
   * @returns {Promise}
   */
  remove(sourceInstance, oldAssociatedObjects, options) {
    const association = this;

    options = options || {};

    oldAssociatedObjects = association.toInstanceArray(oldAssociatedObjects);

    const where = {
      [association.identifier]: sourceInstance.get(association.sourceKey),
      [association.foreignIdentifier]: oldAssociatedObjects.map(newInstance => newInstance.get(association.targetKey))
    };

    return association.through.model.destroy({ ...options, where });
  }

  /**
   * Create a new instance of the associated model and associate it with this.
   *
   * @param {Model} sourceInstance source instance
   * @param {object} [values] values for target model
   * @param {object} [options] Options passed to create and add
   * @param {object} [options.through] Additional attributes for the join table
   *
   * @returns {Promise}
   */
  async create(sourceInstance, values, options) {
    const association = this;

    options = options || {};
    values = values || {};

    if (Array.isArray(options)) {
      options = {
        fields: options
      };
    }

    if (association.scope) {
      Object.assign(values, association.scope);
      if (options.fields) {
        options.fields = options.fields.concat(Object.keys(association.scope));
      }
    }

    // Create the related model instance
    const newAssociatedObject = await association.target.create(values, options);

    await sourceInstance[association.accessors.add](newAssociatedObject, _.omit(options, ['fields']));
    return newAssociatedObject;
  }

  verifyAssociationAlias(alias) {
    if (typeof alias === 'string') {
      return this.as === alias;
    }

    if (alias && alias.plural) {
      return this.as === alias.plural;
    }

    return !this.isAliased;
  }
}

module.exports = BelongsToMany;
module.exports.BelongsToMany = BelongsToMany;
module.exports.default = BelongsToMany;
