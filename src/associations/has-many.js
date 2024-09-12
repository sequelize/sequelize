'use strict';

const Utils = require('./../utils');
const Helpers = require('./helpers');
const _ = require('lodash');
const Association = require('./base');
const Op = require('../operators');

/**
 * One-to-many association
 *
 * In the API reference below, add the name of the association to the method, e.g. for `User.hasMany(Project)` the getter will be `user.getProjects()`.
 * If the association is aliased, use the alias instead, e.g. `User.hasMany(Project, { as: 'jobs' })` will be `user.getJobs()`.
 *
 * @see {@link Model.hasMany}
 */
class HasMany extends Association {
  constructor(source, target, options) {
    super(source, target, options);

    this.associationType = 'HasMany';
    this.targetAssociation = null;
    this.sequelize = source.sequelize;
    this.isMultiAssociation = true;
    this.foreignKeyAttribute = {};

    if (this.options.through) {
      throw new Error('N:M associations are not supported with hasMany. Use belongsToMany instead');
    }

    /*
    * If self association, this is the target association
    */
    if (this.isSelfAssociation) {
      this.targetAssociation = this;
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

    /*
     * Foreign key setup
     */
    if (_.isObject(this.options.foreignKey)) {
      this.foreignKeyAttribute = this.options.foreignKey;
      this.foreignKey = this.foreignKeyAttribute.name || this.foreignKeyAttribute.fieldName;
    } else if (this.options.foreignKey) {
      this.foreignKey = this.options.foreignKey;
    }

    if (!this.foreignKey) {
      this.foreignKey = Utils.camelize(
        [
          this.source.options.name.singular,
          this.source.primaryKeyAttribute
        ].join('_')
      );
    }

    if (this.target.rawAttributes[this.foreignKey]) {
      this.identifierField = this.target.rawAttributes[this.foreignKey].field || this.foreignKey;
      this.foreignKeyField = this.target.rawAttributes[this.foreignKey].field || this.foreignKey;
    }

    /*
     * Source key setup
     */
    this.sourceKey = this.options.sourceKey || this.source.primaryKeyAttribute;

    if (this.source.rawAttributes[this.sourceKey]) {
      this.sourceKeyAttribute = this.sourceKey;
      this.sourceKeyField = this.source.rawAttributes[this.sourceKey].field || this.sourceKey;
    } else {
      this.sourceKeyAttribute = this.source.primaryKeyAttribute;
      this.sourceKeyField = this.source.primaryKeyField;
    }

    // Get singular and plural names
    // try to uppercase the first letter, unless the model forbids it
    const plural = _.upperFirst(this.options.name.plural);
    const singular = _.upperFirst(this.options.name.singular);

    this.associationAccessor = this.as;
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

  // the id is in the target table
  // or in an extra table which connects two tables
  _injectAttributes() {
    const newAttributes = {
      [this.foreignKey]: {
        type: this.options.keyType || this.source.rawAttributes[this.sourceKeyAttribute].type,
        allowNull: true,
        ...this.foreignKeyAttribute
      }
    };

    // Create a new options object for use with addForeignKeyConstraints, to avoid polluting this.options in case it is later used for a n:m
    const constraintOptions = { ...this.options };

    if (this.options.constraints !== false) {
      const target = this.target.rawAttributes[this.foreignKey] || newAttributes[this.foreignKey];
      constraintOptions.onDelete = constraintOptions.onDelete || (target.allowNull ? 'SET NULL' : 'CASCADE');
      constraintOptions.onUpdate = constraintOptions.onUpdate || 'CASCADE';
    }

    Helpers.addForeignKeyConstraints(newAttributes[this.foreignKey], this.source, this.target, constraintOptions, this.sourceKeyField);
    Utils.mergeDefaults(this.target.rawAttributes, newAttributes);

    this.target.refreshAttributes();
    this.source.refreshAttributes();

    this.identifierField = this.target.rawAttributes[this.foreignKey].field || this.foreignKey;
    this.foreignKeyField = this.target.rawAttributes[this.foreignKey].field || this.foreignKey;
    this.sourceKeyField = this.source.rawAttributes[this.sourceKey].field || this.sourceKey;

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
   * @param {Model|Array<Model>} instances source instances
   * @param {object} [options] find options
   * @param {object} [options.where] An optional where clause to limit the associated models
   * @param {string|boolean} [options.scope] Apply a scope on the related model, or remove its default scope by passing false
   * @param {string} [options.schema] Apply a schema on the related model
   *
   * @see
   * {@link Model.findAll}  for a full explanation of options
   *
   * @returns {Promise<Array<Model>>}
   */
  async get(instances, options = {}) {
    const where = {};

    let Model = this.target;
    let instance;
    let values;

    if (!Array.isArray(instances)) {
      instance = instances;
      instances = undefined;
    }

    options = { ...options };

    if (this.scope) {
      Object.assign(where, this.scope);
    }

    if (instances) {
      values = instances.map(_instance => _instance.get(this.sourceKey, { raw: true }));

      if (options.limit && instances.length > 1) {
        options.groupedLimit = {
          limit: options.limit,
          on: this, // association
          values
        };

        delete options.limit;
      } else {
        where[this.foreignKey] = {
          [Op.in]: values
        };
        delete options.groupedLimit;
      }
    } else {
      where[this.foreignKey] = instance.get(this.sourceKey, { raw: true });
    }

    options.where = options.where ?
      { [Op.and]: [where, options.where] } :
      where;

    if (Object.prototype.hasOwnProperty.call(options, 'scope')) {
      if (!options.scope) {
        Model = Model.unscoped();
      } else {
        Model = Model.scope(options.scope);
      }
    }

    if (Object.prototype.hasOwnProperty.call(options, 'schema')) {
      Model = Model.schema(options.schema, options.schemaDelimiter);
    }

    const results = await Model.findAll(options);
    if (instance) return results;

    const result = {};
    for (const _instance of instances) {
      result[_instance.get(this.sourceKey, { raw: true })] = [];
    }

    for (const _instance of results) {
      result[_instance.get(this.foreignKey, { raw: true })].push(_instance);
    }

    return result;
  }

  /**
   * Count everything currently associated with this, using an optional where clause.
   *
   * @param {Model}        instance the source instance
   * @param {object}         [options] find & count options
   * @param {object}         [options.where] An optional where clause to limit the associated models
   * @param {string|boolean} [options.scope] Apply a scope on the related model, or remove its default scope by passing false
   *
   * @returns {Promise<number>}
   */
  async count(instance, options) {
    options = Utils.cloneDeep(options);

    options.attributes = [
      [
        this.sequelize.fn(
          'COUNT',
          this.sequelize.col(`${this.target.name}.${this.target.primaryKeyField}`)
        ),
        'count'
      ]
    ];
    options.raw = true;
    options.plain = true;

    const result = await this.get(instance, options);

    return parseInt(result.count, 10);
  }

  /**
   * Check if one or more rows are associated with `this`.
   *
   * @param {Model} sourceInstance the source instance
   * @param {Model|Model[]|string[]|string|number[]|number} [targetInstances] Can be an array of instances or their primary keys
   * @param {object} [options] Options passed to getAssociations
   *
   * @returns {Promise}
   */
  async has(sourceInstance, targetInstances, options) {
    const where = {};

    if (!Array.isArray(targetInstances)) {
      targetInstances = [targetInstances];
    }

    options = {
      ...options,
      scope: false,
      attributes: [this.target.primaryKeyAttribute],
      raw: true
    };

    where[Op.or] = targetInstances.map(instance => {
      if (instance instanceof this.target) {
        return instance.where();
      }
      return {
        [this.target.primaryKeyAttribute]: instance
      };
    });

    options.where = {
      [Op.and]: [
        where,
        options.where
      ]
    };

    const associatedObjects = await this.get(sourceInstance, options);

    return associatedObjects.length === targetInstances.length;
  }

  /**
   * Set the associated models by passing an array of persisted instances or their primary keys. Everything that is not in the passed array will be un-associated
   *
   * @param {Model} sourceInstance source instance to associate new instances with
   * @param {Model|Model[]|string[]|string|number[]|number} [targetInstances] An array of persisted instances or primary key of instances to associate with this. Pass `null` or `undefined` to remove all associations.
   * @param {object} [options] Options passed to `target.findAll` and `update`.
   * @param {object} [options.validate] Run validation for the join model
   *
   * @returns {Promise}
   */
  async set(sourceInstance, targetInstances, options) {
    if (targetInstances === null) {
      targetInstances = [];
    } else {
      targetInstances = this.toInstanceArray(targetInstances);
    }

    const oldAssociations = await this.get(sourceInstance, { ...options, scope: false, raw: true });
    const promises = [];
    const obsoleteAssociations = oldAssociations.filter(old =>
      !targetInstances.find(obj =>
        obj[this.target.primaryKeyAttribute] === old[this.target.primaryKeyAttribute]
      )
    );
    const unassociatedObjects = targetInstances.filter(obj =>
      !oldAssociations.find(old =>
        obj[this.target.primaryKeyAttribute] === old[this.target.primaryKeyAttribute]
      )
    );
    let updateWhere;
    let update;

    if (obsoleteAssociations.length > 0) {
      update = {};
      update[this.foreignKey] = null;

      updateWhere = {
        [this.target.primaryKeyAttribute]: obsoleteAssociations.map(associatedObject =>
          associatedObject[this.target.primaryKeyAttribute]
        )
      };


      promises.push(this.target.unscoped().update(
        update,
        {
          ...options,
          where: updateWhere
        }
      ));
    }

    if (unassociatedObjects.length > 0) {
      updateWhere = {};

      update = {};
      update[this.foreignKey] = sourceInstance.get(this.sourceKey);

      Object.assign(update, this.scope);
      updateWhere[this.target.primaryKeyAttribute] = unassociatedObjects.map(unassociatedObject =>
        unassociatedObject[this.target.primaryKeyAttribute]
      );

      promises.push(this.target.unscoped().update(
        update,
        {
          ...options,
          where: updateWhere
        }
      ));
    }

    await Promise.all(promises);

    return sourceInstance;
  }

  /**
   * Associate one or more target rows with `this`. This method accepts a Model / string / number to associate a single row,
   * or a mixed array of Model / string / numbers to associate multiple rows.
   *
   * @param {Model} sourceInstance the source instance
   * @param {Model|Model[]|string[]|string|number[]|number} [targetInstances] A single instance or primary key, or a mixed array of persisted instances or primary keys
   * @param {object} [options] Options passed to `target.update`.
   *
   * @returns {Promise}
   */
  async add(sourceInstance, targetInstances, options = {}) {
    if (!targetInstances) return Promise.resolve();


    targetInstances = this.toInstanceArray(targetInstances);

    const update = {
      [this.foreignKey]: sourceInstance.get(this.sourceKey),
      ...this.scope
    };

    const where = {
      [this.target.primaryKeyAttribute]: targetInstances.map(unassociatedObject =>
        unassociatedObject.get(this.target.primaryKeyAttribute)
      )
    };

    await this.target.unscoped().update(update, { ...options, where });

    return sourceInstance;
  }

  /**
   * Un-associate one or several target rows.
   *
   * @param {Model} sourceInstance instance to un associate instances with
   * @param {Model|Model[]|string|string[]|number|number[]} [targetInstances] Can be an Instance or its primary key, or a mixed array of instances and primary keys
   * @param {object} [options] Options passed to `target.update`
   *
   * @returns {Promise}
   */
  async remove(sourceInstance, targetInstances, options = {}) {
    const update = {
      [this.foreignKey]: null
    };

    targetInstances = this.toInstanceArray(targetInstances);

    const where = {
      [this.foreignKey]: sourceInstance.get(this.sourceKey),
      [this.target.primaryKeyAttribute]: targetInstances.map(targetInstance =>
        targetInstance.get(this.target.primaryKeyAttribute)
      )
    };

    await this.target.unscoped().update(update, { ...options, where });

    return this;
  }

  /**
   * Create a new instance of the associated model and associate it with this.
   *
   * @param {Model} sourceInstance source instance
   * @param {object} [values] values for target model instance
   * @param {object} [options] Options passed to `target.create`
   *
   * @returns {Promise}
   */
  async create(sourceInstance, values, options = {}) {
    if (Array.isArray(options)) {
      options = {
        fields: options
      };
    }

    if (values === undefined) {
      values = {};
    }

    if (this.scope) {
      for (const attribute of Object.keys(this.scope)) {
        values[attribute] = this.scope[attribute];
        if (options.fields) options.fields.push(attribute);
      }
    }

    values[this.foreignKey] = sourceInstance.get(this.sourceKey);
    if (options.fields) options.fields.push(this.foreignKey);
    return await this.target.create(values, options);
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

module.exports = HasMany;
module.exports.HasMany = HasMany;
module.exports.default = HasMany;
