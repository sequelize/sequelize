'use strict';

var Toposort = require('toposort-class')
  , Utils = require('./utils')
  , _ = require('lodash');

var ModelManager = function(sequelize) {
  this.models = [];
  this.sequelize = sequelize;
};

ModelManager.prototype.addModel = function(model) {
  this.models.push(model);
  this.sequelize.models[model.name] = model;

  return model;
};

ModelManager.prototype.removeModel = function(model) {
  this.models = this.models.filter(function($model) {
    return $model.name !== model.name;
  });

  delete this.sequelize.models[model.name];
};

ModelManager.prototype.getModel = function(against, options) {
  options = _.defaults(options || {}, {
    attribute: 'name'
  });

  var model = this.models.filter(function(model) {
    return model[options.attribute] === against;
  });

  return !!model ? model[0] : null;
};

ModelManager.prototype.__defineGetter__('all', function() {
  return this.models;
});

/**
 * Iterate over Models in an order suitable for e.g. creating tables. Will
 * take foreign key constraints into account so that dependencies are visited
 * before dependents.
 */
ModelManager.prototype.forEachModel = function(iterator, options) {
  var models = {}
    , sorter = new Toposort()
    , sorted
    , dep;

  options = _.defaults(options || {}, {
    reverse: true
  });

  this.models.forEach(function(model) {
    var deps = []
      , tableName = model.getTableName();

    if (_.isObject(tableName)) {
      tableName = tableName.schema + '.' + tableName.tableName;
    }

    models[tableName] = model;

    for (var attrName in model.rawAttributes) {
      if (model.rawAttributes.hasOwnProperty(attrName)) {
        var attribute = model.rawAttributes[attrName];

        if (attribute.references) {
          attribute = Utils.formatReferences(attribute);
          dep       = attribute.references.model;

          if (_.isObject(dep)) {
            dep = dep.schema + '.' + dep.tableName;
          }

          deps.push(dep);
        }
      }
    }

    deps = deps.filter(function(dep) {
      return tableName !== dep;
    });

    sorter.add(tableName, deps);
  });

  sorted = sorter.sort();
  if (options.reverse) {
    sorted = sorted.reverse();
  }
  sorted.forEach(function(name) {
    iterator(models[name], name);
  });
};

module.exports = ModelManager;
