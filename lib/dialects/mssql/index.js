'use strict';

var _ = require('lodash')
  , Abstract = require('../abstract')
  , ConnectionManager = require('./connection-manager')
  , Query = require('./query');

var MssqlDialect = function(sequelize) {
  this.sequelize = sequelize;
  this.connectionManager = new ConnectionManager(this, sequelize);
  this.connectionManager.initPools();
};

MssqlDialect.prototype.supports = _.merge(_.cloneDeep(Abstract.prototype.supports), {
  'RETURNING': false,
  'OUTPUT': true,
  'DEFAULT': true,
  'DEFAULT VALUES': true,
  'LIMIT ON UPDATE': true,
  lock: false,
  transactions: false,
  migrations: false,
  upserts: false,
  autoIncrement: {
    identityInsert: true,
    defaultValue: false,
    update: false
  },
  constraints: {
    restrict: false
  },
  index: {
    collate: false,
    length: false,
    parser: false,
    type: true,
    using: false,
  }
});

MssqlDialect.prototype.Query = Query;
MssqlDialect.prototype.name = 'mssql';

module.exports = MssqlDialect;
