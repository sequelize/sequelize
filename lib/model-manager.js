'use strict';

var Toposort = require('toposort-class')
  , _ = require('lodash');

module.exports = (function() {
  var ModelManager = function(sequelize) {
    this.daos = [];
    this.sequelize = sequelize;
  };

  ModelManager.prototype.addDAO = function(dao) {
    this.daos.push(dao);
    this.sequelize.models[dao.name] = dao;

    return dao;
  };

  ModelManager.prototype.removeDAO = function(dao) {
    this.daos = this.daos.filter(function(_dao) {
      return _dao.name !== dao.name;
    });
    
    delete this.sequelize.models[dao.name];
  };

  ModelManager.prototype.getDAO = function(daoName, options) {
    options = options || {};
    options.attribute = options.attribute || 'name';

    var dao = this.daos.filter(function(dao) {
      return dao[options.attribute] === daoName;
    });

    return !!dao ? dao[0] : null;
  };

  ModelManager.prototype.__defineGetter__('all', function() {
    return this.daos;
  });

  /**
   * Iterate over DAOs in an order suitable for e.g. creating tables. Will
   * take foreign key constraints into account so that dependencies are visited
   * before dependents.
   */
  ModelManager.prototype.forEachDAO = function(iterator, options) {
    var daos = {}
      , sorter = new Toposort()
      , sorted
      , dep;

    options = _.defaults(options || {}, {
      reverse: true
    });

    this.daos.forEach(function(dao) {
      var deps = []
        , tableName = dao.getTableName();

      if (_.isObject(tableName)) {
        tableName = tableName.schema + '.' + tableName.tableName;
      }

      daos[tableName] = dao;

      for (var attrName in dao.rawAttributes) {
        if (dao.rawAttributes.hasOwnProperty(attrName)) {
          if (dao.rawAttributes[attrName].references) {
            dep = dao.rawAttributes[attrName].references;

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
      iterator(daos[name], name);
    });
  };

  return ModelManager;
})();
