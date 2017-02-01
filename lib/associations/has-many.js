'use strict';

var Utils = require('./../utils')
  , Helpers = require('./helpers')
  , _ = require('lodash')
  , Association = require('./base')
  , CounterCache = require('../plugins/counter-cache')
  , util = require('util');

/**
 * One-to-many association
 *
 * In the API reference below, replace `Association(s)` with the actual name of your association, e.g. for `User.hasMany(Project)` the getter will be `user.getProjects()`.
 *
 * @mixin HasMany
 */
var HasMany = function(source, target, options) {
  Association.call(this);

  this.associationType = 'HasMany';
  this.source = source;
  this.target = target;
  this.targetAssociation = null;
  this.options = options || {};
  this.sequelize = source.modelManager.sequelize;
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
  var plural = Utils.uppercaseFirst(this.options.name.plural)
    , singular = Utils.uppercaseFirst(this.options.name.singular);

  this.accessors = {
    /**
     * Get everything currently associated with this, using an optional where clause.
     *
     * @param {Object} [options]
     * @param {Object} [options.where] An optional where clause to limit the associated models
     * @param {String|Boolean} [options.scope] Apply a scope on the related model, or remove its default scope by passing false
     * @param {String} [options.schema] Apply a schema on the related model
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

  if (this.options.counterCache) {
    new CounterCache(this, this.options.counterCache !== true ? this.options.counterCache : {});
    delete this.accessors.count;
  }
};

util.inherits(HasMany, Association);

// the id is in the target table
// or in an extra table which connects two tables
HasMany.prototype.injectAttributes = function() {
  var newAttributes = {};
  var constraintOptions = _.clone(this.options); // Create a new options object for use with addForeignKeyConstraints, to avoid polluting this.options in case it is later used for a n:m
  newAttributes[this.foreignKey] = _.defaults({}, this.foreignKeyAttribute, {
    type: this.options.keyType || this.source.rawAttributes[this.sourceKeyAttribute].type,
    allowNull : true
  });

  if (this.options.constraints !== false) {
    var target = this.target.rawAttributes[this.foreignKey] || newAttributes[this.foreignKey];
    constraintOptions.onDelete = constraintOptions.onDelete || (target.allowNull ? 'SET NULL' : 'CASCADE');
    constraintOptions.onUpdate = constraintOptions.onUpdate || 'CASCADE';
  }
  Helpers.addForeignKeyConstraints(newAttributes[this.foreignKey], this.source, this.target, constraintOptions, this.sourceKeyField);
  Utils.mergeDefaults(this.target.rawAttributes, newAttributes);

  this.identifierField = this.target.rawAttributes[this.foreignKey].field || this.foreignKey;
  this.foreignKeyField = this.target.rawAttributes[this.foreignKey].field || this.foreignKey;

  this.target.refreshAttributes();
  this.source.refreshAttributes();

  Helpers.checkNamingCollision(this);

  return this;
};

HasMany.prototype.mixin = function(obj) {
  var association = this;

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
};

HasMany.prototype.get = function(instances, options) {
  var association = this
    , where = {}
    , Model = association.target
    , instance
    , values;

  if (!Array.isArray(instances)) {
    instance = instances;
    instances = undefined;
  }

  options = Utils.cloneDeep(options) || {};

  if (association.scope) {
    _.assign(where, association.scope);
  }

  if (instances) {
    values = instances.map(function (instance) {
      return instance.get(association.sourceKey, {raw: true});
    });

    if (options.limit && instances.length > 1) {
      options.groupedLimit = {
        limit: options.limit,
        on: association.foreignKeyField,
        values: values
      };

      delete options.limit;
    } else {
      where[association.foreignKey] = {
        $in: values
      };
      delete options.groupedLimit;
    }
  } else {
    where[association.foreignKey] = instance.get(association.sourceKey, {raw: true});
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


  return Model.findAll(options).then(function (results) {
    if (instance) return results;

    var result = {};
    instances.forEach(function (instance) {
      result[instance.get(association.sourceKey, {raw: true})] = [];
    });

    results.forEach(function (instance) {
      result[instance.get(association.foreignKey, {raw: true})].push(instance);
    });

    return result;
  });
};

HasMany.prototype.count = function(instance, options) {
  var association = this
    , model = association.target
    , sequelize = model.sequelize;

  options = Utils.cloneDeep(options);
  options.attributes = [
    [sequelize.fn('COUNT', sequelize.col(model.primaryKeyField)), 'count']
  ];
  options.raw = true;
  options.plain = true;

  return this.get(instance, options).then(function (result) {
    return parseInt(result.count, 10);
  });
};

HasMany.prototype.has = function(sourceInstance, targetInstances, options) {
  var association = this
    , where = {};

  if (!Array.isArray(targetInstances)) {
    targetInstances = [targetInstances];
  }

  options = _.assign({}, options, {
    scope: false,
    raw: true
  });

  where.$or = targetInstances.map(function (instance) {
    if (instance instanceof association.target.Instance) {
      return instance.where();
    } else {
      var _where = {};
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

  return this.get(
    sourceInstance,
    options
  ).then(function(associatedObjects) {
    return associatedObjects.length === targetInstances.length;
  });
};

HasMany.prototype.set = function(sourceInstance, targetInstances, options) {
  var association = this;

  if (targetInstances === null) {
    targetInstances = [];
  } else {
    targetInstances = association.toInstanceArray(targetInstances);
  }

  return association.get(sourceInstance, _.defaults({
    scope: false,
    raw: true
  }, options)).then(function(oldAssociations) {
    var promises = []
      , obsoleteAssociations = oldAssociations.filter(function(old) {
          return !_.find(targetInstances, function(obj) {
            return obj[association.target.primaryKeyAttribute] === old[association.target.primaryKeyAttribute];
          });
        })
      , unassociatedObjects = targetInstances.filter(function(obj) {
          return !_.find(oldAssociations, function(old) {
            return obj[association.target.primaryKeyAttribute] === old[association.target.primaryKeyAttribute];
          });
        })
      , updateWhere
      , update;

    if (obsoleteAssociations.length > 0) {
      update = {};
      update[association.foreignKey] = null;

      updateWhere = {};

      updateWhere[association.target.primaryKeyAttribute] = obsoleteAssociations.map(function(associatedObject) {
        return associatedObject[association.target.primaryKeyAttribute];
      });

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
      update[association.foreignKey] = sourceInstance.get(association.sourceKey);

      _.assign(update, association.scope);
      updateWhere[association.target.primaryKeyAttribute] = unassociatedObjects.map(function(unassociatedObject) {
        return unassociatedObject[association.target.primaryKeyAttribute];
      });

      promises.push(association.target.unscoped().update(
        update,
        _.defaults({
          where: updateWhere
        }, options)
      ));
    }

    return Utils.Promise.all(promises).return(sourceInstance);
  });
};

HasMany.prototype.add = function(sourceInstance, targetInstances, options) {
  if (!targetInstances) return Utils.Promise.resolve();

  var association = this
    , update = {}
    , where = {};

  options = options || {};

  targetInstances = association.toInstanceArray(targetInstances);

  update[association.foreignKey] = sourceInstance.get(association.sourceKey);
  _.assign(update, association.scope);

  where[association.target.primaryKeyAttribute] = targetInstances.map(function (unassociatedObject) {
    return unassociatedObject.get(association.target.primaryKeyAttribute);
  });

  return association.target.unscoped().update(
    update,
    _.defaults({
      where: where
    }, options)
  ).return(sourceInstance);
};

HasMany.prototype.remove = function(sourceInstance, targetInstances, options) {
  var association = this
    , update = {}
    , where = {};

  options = options || {};
  targetInstances = association.toInstanceArray(targetInstances);

  update[association.foreignKey] = null;

  where[association.foreignKey] = sourceInstance.get(association.sourceKey);
  where[association.target.primaryKeyAttribute] = targetInstances.map(function (targetInstance) {
    return targetInstance.get(association.target.primaryKeyAttribute);
  });

  return association.target.unscoped().update(
    update,
    _.defaults({
      where: where
    }, options)
  ).return(this);
};

HasMany.prototype.create = function(sourceInstance, values, options) {
  var association = this;

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
    Object.keys(association.scope).forEach(function (attribute) {
      values[attribute] = association.scope[attribute];
      if (options.fields) options.fields.push(attribute);
    });
  }

  values[association.foreignKey] = sourceInstance.get(association.sourceKey);
  if (options.fields) options.fields.push(association.foreignKey);
  return association.target.create(values, options);
};

module.exports = HasMany;
module.exports.HasMany = HasMany;
module.exports.default = HasMany;
