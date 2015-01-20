'use strict';

var _ = require('lodash')
  , Abstract = require('../abstract')
  , ConnectionManager = require('./connection-manager')
  , Query = require('./query')
  , QueryGenerator = require('./query-generator');

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
  schemas: true,
  lock: true,
  forShare: 'FOR SHARE',
  index: {
    concurrently: true,
    using: 2,
  }
});

PostgresDialect.prototype.Query = Query;
PostgresDialect.prototype.name = 'postgres';

module.exports = PostgresDialect;
