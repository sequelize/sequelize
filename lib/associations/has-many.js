'use strict';

var Utils = require('./../utils')
  , Helpers = require('./helpers')
  , _ = require('lodash')
  , Association = require('./base')
  , CounterCache = require('../plugins/counter-cache')
  , util = require('util');

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

  if (this.options.through) {
    throw new Error('N:M associations are not supported with hasMany. Use belongsToMany instead');
  }

  if (_.isObject(this.options.foreignKey)) {
    this.foreignKeyAttribute = this.options.foreignKey;
    this.foreignKey = this.foreignKeyAttribute.name || this.foreignKeyAttribute.fieldName;
  } else {
    this.foreignKeyAttribute = {};
    this.foreignKey = this.options.foreignKey;
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

  this.associationAccessor = this.as;

  // Get singular and plural names, trying to uppercase the first letter, unless the model forbids it
  var plural = Utils.uppercaseFirst(this.options.name.plural)
    , singular = Utils.uppercaseFirst(this.options.name.singular);

  this.accessors = {
    get: 'get' + plural,
    set: 'set' + plural,
    addMultiple: 'add' + plural,
    add: 'add' + singular,
    create: 'create' + singular,
    remove: 'remove' + singular,
    removeMultiple: 'remove' + plural,
    hasSingle: 'has' + singular,
    hasAll: 'has' + plural
  };

  if (this.options.counterCache) {
    new CounterCache(this, this.options.counterCache !== true ? this.options.counterCache : {});
  }
};

util.inherits(HasMany, Association);

// the id is in the target table
// or in an extra table which connects two tables
HasMany.prototype.injectAttributes = function() {
  this.identifier = this.foreignKey || _.camelizeIf(
    [
      _.underscoredIf(this.source.options.name.singular, this.source.options.underscored),
      this.source.primaryKeyAttribute
    ].join('_'),
    !this.source.options.underscored
  );

  var newAttributes = {};
  var constraintOptions = _.clone(this.options); // Create a new options object for use with addForeignKeyConstraints, to avoid polluting this.options in case it is later used for a n:m
  newAttributes[this.identifier] = _.defaults(this.foreignKeyAttribute, { type: this.options.keyType || this.source.rawAttributes[this.source.primaryKeyAttribute].type });

  if (this.options.constraints !== false) {
    constraintOptions.onDelete = constraintOptions.onDelete || 'SET NULL';
    constraintOptions.onUpdate = constraintOptions.onUpdate || 'CASCADE';
  }
  Helpers.addForeignKeyConstraints(newAttributes[this.identifier], this.source, this.target, constraintOptions);
  Utils.mergeDefaults(this.target.rawAttributes, newAttributes);

  this.identifierField = this.target.rawAttributes[this.identifier].field || this.identifier;

  this.target.refreshAttributes();
  this.source.refreshAttributes();

  Helpers.checkNamingCollision(this);

  return this;
};

HasMany.prototype.injectGetter = function(obj) {
  var association = this;

  obj[this.accessors.get] = function(options) {
    var scopeWhere = association.scope ? {} : null
      , Model = association.target;

    options = association.target.__optClone(options) || {};

    if (association.scope) {
      _.assign(scopeWhere, association.scope);
    }

    options.where = {
      $and: [
        new Utils.where(
          association.target.rawAttributes[association.identifier],
          this.get(association.source.primaryKeyAttribute, {raw: true})
        ),
        scopeWhere,
        options.where
      ]
    };

    if (options.hasOwnProperty('scope')) {
      if (!options.scope) {
        Model = Model.unscoped();
      } else {
        Model = Model.scope(options.scope);
      }
    }

    return Model.all(options);
  };

  obj[this.accessors.hasSingle] = obj[this.accessors.hasAll] = function(instances, options) {
    var where = {};

    if (!Array.isArray(instances)) {
      instances = [instances];
    }

    options = options || {};
    options.scope = false;

    where.$or = instances.map(function (instance) {
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

    return this[association.accessors.get](
      options,
      { raw: true }
    ).then(function(associatedObjects) {
      return associatedObjects.length === instances.length;
    });
  };

  return this;
};

HasMany.prototype.injectSetter = function(obj) {
  var association = this;

  obj[this.accessors.set] = function(newAssociatedObjects, additionalAttributes) {
    var options = additionalAttributes || {};
    additionalAttributes = additionalAttributes || {};

    if (newAssociatedObjects === null) {
      newAssociatedObjects = [];
    } else {
      newAssociatedObjects = association.toInstanceArray(newAssociatedObjects);
    }

    var instance = this;

    return instance[association.accessors.get](_.defaults({
      scope: false,
      raw: true
    }, options)).then(function(oldAssociations) {
      var promises = []
        , obsoleteAssociations = oldAssociations.filter(function(old) {
            return !_.find(newAssociatedObjects, function(obj) {
              return obj[association.target.primaryKeyAttribute] === old[association.target.primaryKeyAttribute];
            });
          })
        , unassociatedObjects = newAssociatedObjects.filter(function(obj) {
            return !_.find(oldAssociations, function(old) {
              return obj[association.target.primaryKeyAttribute] === old[association.target.primaryKeyAttribute];
            });
          })
        , updateWhere
        , update;

      if (obsoleteAssociations.length > 0) {
        update = {};
        update[association.identifier] = null;

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
        update[association.identifier] = instance.get(association.source.primaryKeyAttribute);

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

      return Utils.Promise.all(promises).return(instance);
    });
  };

  obj[this.accessors.addMultiple] = obj[this.accessors.add] = function(newInstances, options) {
    // If newInstance is null or undefined, no-op
    if (!newInstances) return Utils.Promise.resolve();
    options = options || {};

    var instance = this, update = {}, where = {};

    newInstances = association.toInstanceArray(newInstances);

    update[association.identifier] = instance.get(association.source.primaryKeyAttribute);
    _.assign(update, association.scope);

    where[association.target.primaryKeyAttribute] = newInstances.map(function (unassociatedObject) {
      return unassociatedObject.get(association.target.primaryKeyAttribute);
    });

    return association.target.unscoped().update(
      update,
      _.defaults({
        where: where
      }, options)
    ).return(instance);
 };

  obj[this.accessors.removeMultiple] = obj[this.accessors.remove] = function(oldAssociatedObjects, options) {
    options = options || {};
    oldAssociatedObjects = association.toInstanceArray(oldAssociatedObjects);

    var update = {};
    update[association.identifier] = null;

    var where = {};
    where[association.identifier] = this.get(association.source.primaryKeyAttribute);
    where[association.target.primaryKeyAttribute] = oldAssociatedObjects.map(function (oldAssociatedObject) { return oldAssociatedObject.get(association.target.primaryKeyAttribute); });

    return association.target.unscoped().update(
      update,
      _.defaults({
        where: where
      }, options)
    ).return(this);
  };

  return this;
};

HasMany.prototype.injectCreator = function(obj) {
  var association = this;

  obj[this.accessors.create] = function(values, options) {
    var instance = this;
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

    values[association.identifier] = instance.get(association.source.primaryKeyAttribute);
    if (options.fields) options.fields.push(association.identifier);
    return association.target.create(values, options);
  };

  return this;
};

module.exports = HasMany;
