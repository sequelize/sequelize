'use strict';

var _ = require('lodash')
  , Abstract = require('../abstract')
  , ConnectionManager = require('./connection-manager')
  , Query = require('./query')
  , QueryGenerator = require('./query-generator')
  , DataTypes = require('./data-types');

var MssqlDialect = function(sequelize) {
  this.sequelize = sequelize;
  this.connectionManager = new ConnectionManager(this, sequelize);
  this.connectionManager.initPools();
  this.QueryGenerator = _.extend({}, QueryGenerator, {
    options: sequelize.options,
    _dialect: this,
    sequelize: sequelize
  });
};

MssqlDialect.prototype.supports = _.merge(_.cloneDeep(Abstract.prototype.supports), {
  'DEFAULT': true,
  'DEFAULT VALUES': true,
  'LIMIT ON UPDATE': true,
  'ORDER NULLS': false,
  lock: false,
  transactions: false,
  migrations: false,
  upserts: false,
  returnValues: {
    output: true
  },
  schemas: true,
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
  },
  NUMERIC: true
});

MssqlDialect.prototype.Query = Query;
MssqlDialect.prototype.name = 'mssql';
MssqlDialect.prototype.TICK_CHAR = '"';
MssqlDialect.prototype.TICK_CHAR_LEFT = '[';
MssqlDialect.prototype.TICK_CHAR_RIGHT = ']';
MssqlDialect.prototype.DataTypes = DataTypes;

module.exports = MssqlDialect;
