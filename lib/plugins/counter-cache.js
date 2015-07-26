'use strict';

var Utils = require('./../utils')
  , Helpers = require('../associations/helpers')
  , DataTypes = require('../data-types')
  , Promise = require('bluebird');

var CounterCache = function(association, options) {
  this.association = association;
  this.source = association.source;
  this.target = association.target;
  this.options = options || {};

  this.sequelize = this.source.modelManager.sequelize;
  this.as = this.options.as;

  if (association.associationType !== 'HasMany') {
    throw new Error('Can only have CounterCache on HasMany association');
  }

  if (this.as) {
    this.isAliased = true;
    this.columnName = this.as;
  } else {
    this.as = 'count_' + this.target.options.name.plural;
    this.columnName = Utils.camelizeIf(
      this.as,
      !this.source.options.underscored
    );
  }

  this.injectAttributes();
  this.injectHooks();
};

// Add countAssociation attribute to source model
CounterCache.prototype.injectAttributes = function() {
  // Do not try to use a column that's already taken
  Helpers.checkNamingCollision(this);

  var newAttributes = {};

  newAttributes[this.columnName] = {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: Utils._.partial(
      Utils.toDefaultValue,
      0
    )
  };

  Utils.mergeDefaults(this.source.rawAttributes, newAttributes);

  // Sync attributes and setters/getters to DAO prototype
  this.source.refreshAttributes();
};

// Add setAssociaton method to the prototype of the model instance
CounterCache.prototype.injectHooks = function() {
  var association = this.association,
    counterCacheInstance = this,
    CounterUtil,
    fullUpdateHook,
    atomicHooks,
    previousTargetId;

  CounterUtil = {
    update: function (targetId, options) {
      var query = CounterUtil._targetQuery(targetId);

      return association.target.count({ where: query, logging: options && options.logging }).then(function (count) {
        var newValues = {};

        query = CounterUtil._sourceQuery(targetId);

        newValues[counterCacheInstance.columnName] = count;

        return association.source.update(newValues, { where: query, logging: options && options.logging });
      });
    },
    increment: function (targetId, options) {
      var query = CounterUtil._sourceQuery(targetId);

      return association.source.find({ where: query, logging: options && options.logging }).then(function (instance) {
        return instance.increment(counterCacheInstance.columnName, { by: 1, logging: options && options.logging });
      });
    },
    decrement: function (targetId, options) {
      var query = CounterUtil._sourceQuery(targetId);

      return association.source.find({ where: query, logging: options && options.logging }).then(function (instance) {
        return instance.decrement(counterCacheInstance.columnName, { by: 1, logging: options && options.logging });
      });
    },
    // helpers
    _targetQuery: function (id) {
      var query = {};

      query[association.foreignKey] = id;

      return query;
    },
    _sourceQuery: function (id) {
      var query = {};

      query[association.source.primaryKeyAttribute] = id;

      return query;
    }
  };

  fullUpdateHook = function (target, options) {
    var targetId = target.get(association.foreignKey)
      , promises = [];

    if (targetId) {
      promises.push(CounterUtil.update(targetId, options));
    }

    if (previousTargetId && previousTargetId !== targetId) {
      promises.push(CounterUtil.update(previousTargetId, options));
    }

    return Promise.all(promises).return(undefined);
  };

  atomicHooks = {
    create: function (target, options) {
      var targetId = target.get(association.foreignKey);

      if (targetId) {
        return CounterUtil.increment(targetId, options);
      }
    },
    update: function (target, options) {
      var targetId = target.get(association.foreignKey)
        , promises = [];

      if (targetId && !previousTargetId) {
        promises.push(CounterUtil.increment(targetId, options));
      }
      if (!targetId && previousTargetId) {
        promises.push(CounterUtil.decrement(targetId, options));
      }
      if (previousTargetId && targetId && previousTargetId !== targetId) {
        promises.push(CounterUtil.increment(targetId, options));
        promises.push(CounterUtil.decrement(previousTargetId, options));
      }

      return Promise.all(promises);
    },
    destroy: function (target, options) {
      var targetId = target.get(association.foreignKey);

      if (targetId) {
        return CounterUtil.decrement(targetId, options);
      }
    }
  };

  // previousDataValues are cleared before afterUpdate, so we need to save this here
  association.target.addHook('beforeUpdate', function (target) {
    previousTargetId = target.previous(association.foreignKey);
  });

  if (this.options.atomic === false) {
    association.target.addHook('afterCreate', fullUpdateHook);
    association.target.addHook('afterUpdate', fullUpdateHook);
    association.target.addHook('afterDestroy', fullUpdateHook);
  } else {
    association.target.addHook('afterCreate', atomicHooks.create);
    association.target.addHook('afterUpdate', atomicHooks.update);
    association.target.addHook('afterDestroy', atomicHooks.destroy);
  }
};

module.exports = CounterCache;
