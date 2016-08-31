'use strict';

const Utils = require('./../utils');
const Helpers = require('./helpers');
const _ = require('lodash');
const Association = require('./base');

/**
 * One-to-many association
 *
 * In the API reference below, replace `Association(s)` with the actual name of your association, e.g. for `User.hasMany(Project)` the getter will be `user.getProjects()`.
 *
 * @mixin HasMany
 */
class HasMany extends Association {
  constructor(source, target, options) {
    super();

    this.associationType = 'HasMany';
    this.source = source;
    this.target = target;
    this.targetAssociation = null;
    this.options = options || {};
    this.sequelize = source.sequelize;
    this.through = options.through;
    this.scope = options.scope;
    this.isMultiAssociation = true;
    this.isSelfAssociation = this.source === this.target;
    this.as = this.options.as;
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

    this.associationAccessor = this.as;

    // Get singular and plural names, trying to uppercase the first letter, unless the model forbids it
    const plural = Utils.uppercaseFirst(this.options.name.plural);
    const singular = Utils.uppercaseFirst(this.options.name.singular);

    this.accessors = {
      /**
       * Get everything currently associated with this, using an optional where clause.
       *
       * @param {Object} [options]
       * @param {Object} [options.where] An optional where clause to limit the associated models
       * @param {String|Boolean} [options.scope] Apply a scope on the related model, or remove its default scope by passing false
       * @param {String} [options.schema] Apply a schema on the related model
       * @see {Model#findAll}  for a full explanation of options
       * @return {Promise<Array<Instance>>}
       * @method getAssociations
       */
      get: 'get' + plural,
      /**
       * Set the associated models by passing an array of persisted instances or their primary keys. Everything that is not in the passed array will be un-associated
       *
       * @param {Array<Instance|String|Number>} [newAssociations] An array of persisted instances or primary key of instances to associate with this. Pass `null` or `undefined` to remove all associations.
       * @param {Object} [options] Options passed to `target.findAll` and `update`.
       * @param {Object} [options.validate] Run validation for the join model
       * @return {Promise}
       * @method setAssociations
       */
      set: 'set' + plural,
      /**
       * Associate several persisted instances with this.
       *
       * @param {Array<Instance|String|Number>} [newAssociations] An array of persisted instances or primary key of instances to associate with this.
       * @param {Object} [options] Options passed to `target.update`.
       * @param {Object} [options.validate] Run validation for the join model.
       * @return {Promise}
       * @method addAssociations
       */
      addMultiple: 'add' + plural,
      /**
       * Associate a persisted instance with this.
       *
       * @param {Instance|String|Number} [newAssociation] A persisted instance or primary key of instance to associate with this.
       * @param {Object} [options] Options passed to `target.update`.
       * @param {Object} [options.validate] Run validation for the join model.
       * @return {Promise}
       * @method addAssociation
       */
      add: 'add' + singular,
      /**
       * Create a new instance of the associated model and associate it with this.
       *
       * @param {Object} [values]
       * @param {Object} [options] Options passed to `target.create`.
       * @return {Promise}
       * @method createAssociation
       */
      create: 'create' + singular,
      /**
       * Un-associate the instance.
       *
       * @param {Instance|String|Number} [oldAssociated] Can be an Instance or its primary key
       * @param {Object} [options] Options passed to `target.update`
       * @return {Promise}
       * @method removeAssociation
       */
      remove: 'remove' + singular,
      /**
       * Un-associate several instances.
       *
       * @param {Array<Instance|String|Number>} [oldAssociatedArray] Can be an array of instances or their primary keys
       * @param {Object} [options] Options passed to `through.destroy`
       * @return {Promise}
       * @method removeAssociations
       */
      removeMultiple: 'remove' + plural,
      /**
       * Check if an instance is associated with this.
       *
       * @param {Instance|String|Number} [instance] Can be an Instance or its primary key
       * @param {Object} [options] Options passed to getAssociations
       * @return {Promise}
       * @method hasAssociation
       */
      hasSingle: 'has' + singular,
      /**
       * Check if all instances are associated with this.
       *
       * @param {Array<Instance|String|Number>} [instances] Can be an array of instances or their primary keys
       * @param {Object} [options] Options passed to getAssociations
       * @return {Promise}
       * @method hasAssociations
       */
      hasAll: 'has' + plural,
      /**
       * Count everything currently associated with this, using an optional where clause.
       *
       * @param {Object} [options]
       * @param {Object} [options.where] An optional where clause to limit the associated models
       * @param {String|Boolean} [options.scope] Apply a scope on the related model, or remove its default scope by passing false
       * @return {Promise<Int>}
       * @method countAssociations
       */
      count: 'count' + plural
    };
  }

  // the id is in the target table
  // or in an extra table which connects two tables
  injectAttributes() {
    const newAttributes = {};
    const constraintOptions = _.clone(this.options); // Create a new options object for use with addForeignKeyConstraints, to avoid polluting this.options in case it is later used for a n:m
    newAttributes[this.foreignKey] = _.defaults({}, this.foreignKeyAttribute, {
      type: this.options.keyType || this.source.rawAttributes[this.source.primaryKeyAttribute].type,
      allowNull : true
    });

    if (this.options.constraints !== false) {
      const target = this.target.rawAttributes[this.foreignKey] || newAttributes[this.foreignKey];
      constraintOptions.onDelete = constraintOptions.onDelete || (target.allowNull ? 'SET NULL' : 'CASCADE');
      constraintOptions.onUpdate = constraintOptions.onUpdate || 'CASCADE';
    }
    Helpers.addForeignKeyConstraints(newAttributes[this.foreignKey], this.source, this.target, constraintOptions);
    Utils.mergeDefaults(this.target.rawAttributes, newAttributes);

    this.identifierField = this.target.rawAttributes[this.foreignKey].field || this.foreignKey;
    this.foreignKeyField = this.target.rawAttributes[this.foreignKey].field || this.foreignKey;

    this.target.refreshAttributes();
    this.source.refreshAttributes();

    Helpers.checkNamingCollision(this);

    return this;
  }

  mixin(obj) {
    const association = this;

    obj[this.accessors.get] = function(options) {
      return association.get(this, options);
    };

    if (this.accessors.count) {
      obj[this.accessors.count] = function(options) {
        return association.count(this, options);
      };
    }

    obj[this.accessors.hasSingle] = obj[this.accessors.hasAll] = function(instances, options) {
      return association.has(this, instances, options);
    };

    obj[this.accessors.set] = function(instances, options) {
      return association.set(this, instances, options);
    };

    obj[this.accessors.add] = obj[this.accessors.addMultiple] = function(instances, options) {
      return association.add(this, instances, options);
    };

    obj[this.accessors.remove] = obj[this.accessors.removeMultiple] = function(instances, options) {
      return association.remove(this, instances, options);
    };

    obj[this.accessors.create] = function(values, options) {
      return association.create(this, values, options);
    };
  }

  get(instances, options) {
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
      _.assign(where, association.scope);
    }

    if (instances) {
      values = instances.map(instance => instance.get(association.source.primaryKeyAttribute, {raw: true}));

      if (options.limit && instances.length > 1) {
        options.groupedLimit = {
          limit: options.limit,
          on: association.foreignKeyField,
          values
        };

        delete options.limit;
      } else {
        where[association.foreignKey] = {
          $in: values
        };
        delete options.groupedLimit;
      }
    } else {
      where[association.foreignKey] = instance.get(association.source.primaryKeyAttribute, {raw: true});
    }


    options.where = options.where ?
                    {$and: [where, options.where]} :
                    where;

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


    return Model.findAll(options).then(results => {
      if (instance) return results;

      const result = {};
      for (const instance of instances) {
        result[instance.get(association.source.primaryKeyAttribute, {raw: true})] = [];
      }

      for (const instance of results) {
        result[instance.get(association.foreignKey, {raw: true})].push(instance);
      }

      return result;
    });
  }

  count(instance, options) {
    const association = this;
    const model = association.target;
    const sequelize = model.sequelize;

    options = Utils.cloneDeep(options);
    options.attributes = [
      [sequelize.fn('COUNT', sequelize.col(model.primaryKeyField)), 'count']
    ];
    options.raw = true;
    options.plain = true;

    return this.get(instance, options).then(result => parseInt(result.count, 10));
  }

  has(sourceInstance, targetInstances, options) {
    const association = this;
    const where = {};

    if (!Array.isArray(targetInstances)) {
      targetInstances = [targetInstances];
    }

    options = _.assign({}, options, {
      scope: false,
      raw: true
    });

    where.$or = targetInstances.map(instance => {
      if (instance instanceof association.target) {
        return instance.where();
      } else {
        const _where = {};
        _where[association.target.primaryKeyAttribute] = instance;
        return _where;
      }
    });

    options.where = {
      $and: [
        where,
        options.where
      ]
    };

    return this.get(sourceInstance, options).then(associatedObjects => associatedObjects.length === targetInstances.length);
  }

  set(sourceInstance, targetInstances, options) {
    const association = this;

    if (targetInstances === null) {
      targetInstances = [];
    } else {
      targetInstances = association.toInstanceArray(targetInstances);
    }

    return association.get(sourceInstance, _.defaults({scope: false, raw: true}, options)).then(oldAssociations => {
      const promises = [];
      const obsoleteAssociations = oldAssociations.filter(old =>
        !_.find(targetInstances, obj =>
          obj[association.target.primaryKeyAttribute] === old[association.target.primaryKeyAttribute]
        )
      );
      const unassociatedObjects = targetInstances.filter(obj =>
        !_.find(oldAssociations, old =>
          obj[association.target.primaryKeyAttribute] === old[association.target.primaryKeyAttribute]
        )
      );
      let updateWhere;
      let update;

      if (obsoleteAssociations.length > 0) {
        update = {};
        update[association.foreignKey] = null;

        updateWhere = {};

        updateWhere[association.target.primaryKeyAttribute] = obsoleteAssociations.map(associatedObject =>
          associatedObject[association.target.primaryKeyAttribute]
        );

        promises.push(association.target.unscoped().update(
          update,
          _.defaults({
            where: updateWhere
          }, options)
        ));
      }

      if (unassociatedObjects.length > 0) {
        updateWhere = {};

        update = {};
        update[association.foreignKey] = sourceInstance.get(association.source.primaryKeyAttribute);

        _.assign(update, association.scope);
        updateWhere[association.target.primaryKeyAttribute] = unassociatedObjects.map(unassociatedObject =>
          unassociatedObject[association.target.primaryKeyAttribute]
        );

        promises.push(association.target.unscoped().update(
          update,
          _.defaults({
            where: updateWhere
          }, options)
        ));
      }

      return Utils.Promise.all(promises).return(sourceInstance);
    });
  }

  add(sourceInstance, targetInstances, options) {
    if (!targetInstances) return Utils.Promise.resolve();

    const association = this;
    const update = {};
    const where = {};

    options = options || {};

    targetInstances = association.toInstanceArray(targetInstances);

    update[association.foreignKey] = sourceInstance.get(association.source.primaryKeyAttribute);
    _.assign(update, association.scope);

    where[association.target.primaryKeyAttribute] = targetInstances.map(unassociatedObject =>
      unassociatedObject.get(association.target.primaryKeyAttribute)
    );

    return association.target.unscoped().update(update, _.defaults({where}, options)).return(sourceInstance);
  }

  remove(sourceInstance, targetInstances, options) {
    const association = this;
    const update = {};
    const where = {};

    options = options || {};
    targetInstances = association.toInstanceArray(targetInstances);

    update[association.foreignKey] = null;

    where[association.foreignKey] = sourceInstance.get(association.source.primaryKeyAttribute);
    where[association.target.primaryKeyAttribute] = targetInstances.map(targetInstance =>
      targetInstance.get(association.target.primaryKeyAttribute)
    );

    return association.target.unscoped().update(update, _.defaults({where}, options)).return(this);
  }

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
        if (options.fields) options.fields.push(attribute);
      }
    }

    values[association.foreignKey] = sourceInstance.get(association.source.primaryKeyAttribute);
    if (options.fields) options.fields.push(association.foreignKey);
    return association.target.create(values, options);
  }
}

module.exports = HasMany;
module.exports.HasMany = HasMany;
module.exports.default = HasMany;
