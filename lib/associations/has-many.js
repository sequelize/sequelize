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
    this.through = options.through;
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
    if (typeof this.options.foreignKey === 'object' && this.options.foreignKey !== null) {
      this.foreignKeyAttribute = this.options.foreignKey;
      this.foreignKey = this.foreignKeyAttribute.name || this.foreignKeyAttribute.fieldName;
    } else if (this.options.foreignKey) {
      this.foreignKey = this.options.foreignKey;
    }

    if (!this.foreignKey) {
      this.foreignKey = Utils.camelizeIf(
        [
          Utils.underscoredIf(this.source.options.name.singular, this.source.options.underscored),
          this.source.primaryKeyAttribute
        ].join('_'),
        !this.source.options.underscored
      );
    }

    if (this.target.rawAttributes[this.foreignKey]) {
      this.identifierField = this.target.rawAttributes[this.foreignKey].field || this.foreignKey;
      this.foreignKeyField = this.target.rawAttributes[this.foreignKey].field || this.foreignKey;
    }

    this.sourceKey = this.options.sourceKey || this.source.primaryKeyAttribute;
    if (this.target.rawAttributes[this.sourceKey]) {
      this.sourceKeyField = this.source.rawAttributes[this.sourceKey].field || this.sourceKey;
    } else {
      this.sourceKeyField = this.sourceKey;
    }

    if (this.source.fieldRawAttributesMap[this.sourceKey]) {
      this.sourceKeyAttribute = this.source.fieldRawAttributesMap[this.sourceKey].fieldName;
    } else {
      this.sourceKeyAttribute = this.source.primaryKeyAttribute;
    }
    this.sourceIdentifier = this.sourceKey;
    this.associationAccessor = this.as;

    // Get singular and plural names, trying to uppercase the first letter, unless the model forbids it
    const plural = Utils.uppercaseFirst(this.options.name.plural);
    const singular = Utils.uppercaseFirst(this.options.name.singular);

    this.accessors = {
      get: 'get' + plural,
      set: 'set' + plural,
      addMultiple: 'add' + plural,
      add: 'add' + singular,
      create: 'create' + singular,
      remove: 'remove' + singular,
      removeMultiple: 'remove' + plural,
      hasSingle: 'has' + singular,
      hasAll: 'has' + plural,
      count: 'count' + plural
    };
  }

  // the id is in the target table
  // or in an extra table which connects two tables
  injectAttributes() {
    const newAttributes = {};
    const constraintOptions = Object.assign({}, this.options); // Create a new options object for use with addForeignKeyConstraints, to avoid polluting this.options in case it is later used for a n:m
    newAttributes[this.foreignKey] = Object.assign(
      {
        type: this.options.keyType || this.source.rawAttributes[this.sourceKeyAttribute].type,
        allowNull: true
      },
      this.foreignKeyAttribute
    );

    if (this.options.constraints !== false) {
      const target = this.target.rawAttributes[this.foreignKey] || newAttributes[this.foreignKey];
      constraintOptions.onDelete = constraintOptions.onDelete || (target.allowNull ? 'SET NULL' : 'CASCADE');
      constraintOptions.onUpdate = constraintOptions.onUpdate || 'CASCADE';
    }
    Helpers.addForeignKeyConstraints(
      newAttributes[this.foreignKey],
      this.source,
      this.target,
      constraintOptions,
      this.sourceKeyField
    );
    Utils.mergeDefaults(this.target.rawAttributes, newAttributes);

    this.identifierField = this.target.rawAttributes[this.foreignKey].field || this.foreignKey;
    this.foreignKeyField = this.target.rawAttributes[this.foreignKey].field || this.foreignKey;

    this.target.refreshAttributes();
    this.source.refreshAttributes();

    Helpers.checkNamingCollision(this);

    return this;
  }

  mixin(obj) {
    const methods = [
      'get',
      'count',
      'hasSingle',
      'hasAll',
      'set',
      'add',
      'addMultiple',
      'remove',
      'removeMultiple',
      'create'
    ];
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
   * @param {Object} [options]
   * @param {Object} [options.where] An optional where clause to limit the associated models
   * @param {String|Boolean} [options.scope] Apply a scope on the related model, or remove its default scope by passing false
   * @param {String} [options.schema] Apply a schema on the related model
   * @see {@link Model.findAll}  for a full explanation of options
   * @return {Promise<Array<Model>>}
   */
  async get(instances, options) {
    const association = this;
    const where = {};
    let Model = association.target;
    let instance;
    let values;

    if (!Array.isArray(instances)) {
      instance = instances;
      instances = undefined;
    }

    options = Utils.cloneDeep(options) || {};

    if (association.scope) {
      Object.assign(where, association.scope);
    }

    if (instances) {
      values = instances.map((inst) => inst.get(association.sourceKey, { raw: true }));

      if (options.limit && instances.length > 1) {
        options.groupedLimit = {
          limit: options.limit,
          on: association,
          values
        };

        delete options.limit;
      } else {
        where[association.foreignKey] = {
          [Op.in]: values
        };
        delete options.groupedLimit;
      }
    } else {
      where[association.foreignKey] = instance.get(association.sourceKey, { raw: true });
    }

    options.where = options.where ? { [Op.and]: [where, options.where] } : where;

    if (options.hasOwnProperty('scope')) {
      if (!options.scope) {
        Model = Model.unscoped();
      } else {
        Model = Model.scope(options.scope);
      }
    }

    if (options.hasOwnProperty('schema')) {
      Model = Model.schema(options.schema, options.schemaDelimiter);
    }

    const results = await Model.findAll(options);
    if (instance) {
      return results;
    }

    const result = {};
    for (const inst of instances) {
      result[inst.get(association.sourceKey, { raw: true })] = [];
    }

    for (const inst of results) {
      result[inst.get(association.foreignKey, { raw: true })].push(inst);
    }

    return result;
  }

  /**
   * Count everything currently associated with this, using an optional where clause.
   *
   * @param {Object} [options]
   * @param {Object} [options.where] An optional where clause to limit the associated models
   * @param {String|Boolean} [options.scope] Apply a scope on the related model, or remove its default scope by passing false
   * @return {Promise<Integer>}
   */
  async count(instance, options) {
    const association = this;
    const model = association.target;
    const sequelize = model.sequelize;

    options = Utils.cloneDeep(options);
    options.attributes = [
      [sequelize.fn('COUNT', sequelize.col(model.name.concat('.', model.primaryKeyField))), 'count']
    ];
    options.raw = true;
    options.plain = true;

    const result = await association.get(instance, options);

    return parseInt(result.count, 10);
  }

  /**
   * Check if one or more rows are associated with `this`.
   *
   * @param {Model[]|Model|string[]|String|number[]|Number} [instance(s)]
   * @param {Object} [options] Options passed to getAssociations
   * @return {Promise}
   */
  async has(sourceInstance, targetInstances, options) {
    const association = this;
    const where = {};

    if (!Array.isArray(targetInstances)) {
      targetInstances = [targetInstances];
    }

    options = Object.assign({}, options, {
      scope: false,
      raw: true
    });

    where[Op.or] = targetInstances.map((instance) => {
      if (instance instanceof association.target) {
        return instance.where();
      } else {
        const _where = {};
        _where[association.target.primaryKeyAttribute] = instance;
        return _where;
      }
    });

    options.where = {
      [Op.and]: [where, options.where]
    };

    const associatedObjects = await association.get(sourceInstance, options);

    return associatedObjects.length === targetInstances.length;
  }

  /**
   * Set the associated models by passing an array of persisted instances or their primary keys. Everything that is not in the passed array will be un-associated
   *
   * @param {Array<Model|String|Number>} [newAssociations] An array of persisted instances or primary key of instances to associate with this. Pass `null` or `undefined` to remove all associations.
   * @param {Object} [options] Options passed to `target.findAll` and `update`.
   * @param {Object} [options.validate] Run validation for the join model
   * @return {Promise}
   */
  async set(sourceInstance, targetInstances, options) {
    const association = this;

    if (targetInstances === null) {
      targetInstances = [];
    } else {
      targetInstances = association.toInstanceArray(targetInstances);
    }

    const oldAssociations = await association.get(
      sourceInstance,
      Object.assign({}, options, { scope: false, raw: true })
    );
    const promises = [];
    const obsoleteAssociations = oldAssociations.filter(
      (old) =>
        !targetInstances.find(
          (obj) => obj[association.target.primaryKeyAttribute] === old[association.target.primaryKeyAttribute]
        )
    );
    const unassociatedObjects = targetInstances.filter(
      (obj) =>
        !oldAssociations.find(
          (old) => obj[association.target.primaryKeyAttribute] === old[association.target.primaryKeyAttribute]
        )
    );
    let updateWhere;
    let update;

    if (obsoleteAssociations.length > 0) {
      update = {};
      update[association.foreignKey] = null;

      updateWhere = {};

      updateWhere[association.target.primaryKeyAttribute] = obsoleteAssociations.map(
        (associatedObject) => associatedObject[association.target.primaryKeyAttribute]
      );

      promises.push(
        association.target.unscoped().update(
          update,
          Object.assign({}, options, {
            where: updateWhere
          })
        )
      );
    }

    if (unassociatedObjects.length > 0) {
      updateWhere = {};

      update = {};
      update[association.foreignKey] = sourceInstance.get(association.sourceKey);

      Object.assign(update, association.scope);
      updateWhere[association.target.primaryKeyAttribute] = unassociatedObjects.map(
        (unassociatedObject) => unassociatedObject[association.target.primaryKeyAttribute]
      );

      promises.push(
        association.target.unscoped().update(
          update,
          Object.assign({}, options, {
            where: updateWhere
          })
        )
      );
    }

    await Promise.all(promises);

    return sourceInstance;
  }

  /**
   * Associate one or more target rows with `this`. This method accepts a Model / string / number to associate a single row,
   * or a mixed array of Model / string / numbers to associate multiple rows.
   *
   * @param {Model[]|Model|string[]|string|number[]|number} [newAssociation(s)]
   * @param {Object} [options] Options passed to `target.update`.
   * @return {Promise}
   */
  async add(sourceInstance, targetInstances, options) {
    if (!targetInstances) {
      return Promise.resolve();
    }

    const association = this;
    const update = {};
    const where = {};

    options = options || {};

    targetInstances = association.toInstanceArray(targetInstances);

    update[association.foreignKey] = sourceInstance.get(association.sourceKey);
    Object.assign(update, association.scope);

    where[association.target.primaryKeyAttribute] = targetInstances.map((unassociatedObject) =>
      unassociatedObject.get(association.target.primaryKeyAttribute)
    );

    await association.target.unscoped().update(update, Object.assign({}, options, { where }));

    return sourceInstance;
  }

  /**
   * Un-associate one or several target rows.
   *
   * @param {Model[]|Model|String[]|string|Number[]|number} [oldAssociatedInstance(s)]
   * @param {Object} [options] Options passed to `target.update`
   * @return {Promise}
   */
  async remove(sourceInstance, targetInstances, options) {
    const association = this;
    const update = {};
    const where = {};

    options = options || {};
    targetInstances = association.toInstanceArray(targetInstances);

    update[association.foreignKey] = null;

    where[association.foreignKey] = sourceInstance.get(association.sourceKey);
    where[association.target.primaryKeyAttribute] = targetInstances.map((targetInstance) =>
      targetInstance.get(association.target.primaryKeyAttribute)
    );

    await association.target.unscoped().update(update, Object.assign({}, options, { where }));

    return this;
  }

  /**
   * Create a new instance of the associated model and associate it with this.
   *
   * @param {Object} [values]
   * @param {Object} [options] Options passed to `target.create`.
   * @return {Promise}
   */
  create(sourceInstance, values, options) {
    const association = this;

    options = options || {};

    if (Array.isArray(options)) {
      options = {
        fields: options
      };
    }

    if (values === undefined) {
      values = {};
    }

    if (association.scope) {
      for (const attribute of Object.keys(association.scope)) {
        values[attribute] = association.scope[attribute];
        if (options.fields) {
          options.fields.push(attribute);
        }
      }
    }

    values[association.foreignKey] = sourceInstance.get(association.sourceKey);
    if (options.fields) {
      options.fields.push(association.foreignKey);
    }

    return association.target.create(values, options);
  }
}

module.exports = HasMany;
module.exports.HasMany = HasMany;
module.exports.default = HasMany;
