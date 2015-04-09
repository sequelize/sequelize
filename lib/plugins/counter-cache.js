'use strict';

var Utils = require('./../utils')
  , Helpers = require('../associations/helpers')
  , DataTypes = require('../data-types')
  , Promise = require('bluebird');

module.exports = (function() {
  var CounterCache = function(association, options) {
    this.association = association;
    this.source = association.source;
    this.target = association.target;
    this.options = options || {};

    this.sequelize = this.source.daoFactoryManager.sequelize;
    this.as = this.options.as;

    if (association.associationType !== 'HasMany') {
      throw new Error('Can only have CounterCache on HasMany association');
    }

    if (this.as) {
      this.isAliased = true;
      this.columnName = this.as;
    } else {
      this.as = 'count_' + this.target.options.name.plural;
      this.columnName = Utils._.camelizeIf(
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
      update: function (targetId) {
        var query = CounterUtil._targetQuery(targetId);

        return association.target.count({ where: query }).then(function (count) {
          var newValues = {};

          query = CounterUtil._sourceQuery(targetId);

          newValues[counterCacheInstance.columnName] = count;

          return association.source.update(newValues, { where: query });
        });
      },
      increment: function (targetId) {
        var query = CounterUtil._sourceQuery(targetId);

        return association.source.find({ where: query }).then(function (instance) {
          return instance.increment(counterCacheInstance.columnName, { by: 1 });
        });
      },
      decrement: function (targetId) {
        var query = CounterUtil._sourceQuery(targetId);

        return association.source.find({ where: query }).then(function (instance) {
          return instance.decrement(counterCacheInstance.columnName, { by: 1 });
        });
      },
      // helpers
      _targetQuery: function (id) {
        var query = {};

        query[association.identifier] = id;

        return query;
      },
      _sourceQuery: function (id) {
        var query = {};

        query[association.source.primaryKeyAttribute] = id;

        return query;
      }
    };

    fullUpdateHook = function (target) {
      var targetId = target.get(association.identifier)
        , promises = [];

      if (targetId) {
        promises.push(CounterUtil.update(targetId));
      }

      if (previousTargetId && previousTargetId !== targetId) {
        promises.push(CounterUtil.update(previousTargetId));
      }

      return Promise.all(promises).return(undefined);
    };

    atomicHooks = {
      create: function (target) {
        var targetId = target.get(association.identifier);

        if (targetId) {
          return CounterUtil.increment(targetId);
        }
      },
      update: function (target) {
        var targetId = target.get(association.identifier)
          , promises = [];

        if (targetId && !previousTargetId) {
          promises.push(CounterUtil.increment(targetId));
        }
        if (!targetId && previousTargetId) {
          promises.push(CounterUtil.decrement(targetId));
        }
        if (previousTargetId && targetId && previousTargetId !== targetId) {
          promises.push(CounterUtil.increment(targetId));
          promises.push(CounterUtil.decrement(previousTargetId));
        }

        return Promise.all(promises);
      },
      destroy: function (target) {
        var targetId = target.get(association.identifier);

        if (targetId) {
          return CounterUtil.decrement(targetId);
        }
      }
    };

    // previousDataValues are cleared before afterUpdate, so we need to save this here
    association.target.addHook('beforeUpdate', function (target) {
      previousTargetId = target.previous(association.identifier);
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

  return CounterCache;
})();
