'use strict';

var _ = require('lodash')
  , Abstract = require('../abstract')
  , ConnectionManager = require('./connection-manager')
  , Query = require('./query');

//MSSQL uses a single connection that pools on its own
var MssqlDialect = function(sequelize) {
  this.sequelize = sequelize;
  this.connectionManager = new ConnectionManager(this, sequelize);
};

MssqlDialect.prototype.supports = _.merge(_.cloneDeep(Abstract.prototype.supports), {
  'RETURNING': false,
  'OUTPUT': true,
  'DEFAULT VALUES': true,
  'LIMIT ON UPDATE': true,
  lock: false,
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

module.exports = MssqlDialect;
