'use strict';

var _ = require('lodash')
  , Abstract = require('../abstract')
  , ConnectionManager = require('./connection-manager')
  , Query = require('./query')
  , QueryGenerator = require('./query-generator')
  , DataTypes = require('../../data-types').postgres;

var PostgresDialect = function(sequelize) {
  this.sequelize = sequelize;
  this.connectionManager = new ConnectionManager(this, sequelize);
  this.connectionManager.initPools();

  this.QueryGenerator = _.extend({}, QueryGenerator, {
    options: sequelize.options,
    _dialect: this,
    sequelize: sequelize
  });
};

PostgresDialect.prototype.supports = _.merge(_.cloneDeep(Abstract.prototype.supports), {
  'DEFAULT VALUES': true,
  'EXCEPTION': true,
  'ON DUPLICATE KEY': false,
  'ORDER NULLS': true,
  returnValues: {
    returning: true
  },
  bulkDefault: true,
  schemas: true,
  lock: true,
  lockOf: true,
  lockKey: true,
  lockOuterJoinFailure: true,
  forShare: 'FOR SHARE',
  index: {
    concurrently: true,
    using: 2,
    where: true
  },
  NUMERIC: true,
  ARRAY: true,
  GEOMETRY: true,
  GEOGRAPHY: true,
  JSON: true,
  JSONB: true,
  deferrableConstraints: true,
  searchPath : true
});

ConnectionManager.prototype.defaultVersion = '9.4.0';
PostgresDialect.prototype.Query = Query;
PostgresDialect.prototype.DataTypes = DataTypes;
PostgresDialect.prototype.name = 'postgres';
PostgresDialect.prototype.TICK_CHAR = '"';
PostgresDialect.prototype.TICK_CHAR_LEFT = PostgresDialect.prototype.TICK_CHAR;
PostgresDialect.prototype.TICK_CHAR_RIGHT = PostgresDialect.prototype.TICK_CHAR;

module.exports = PostgresDialect;
