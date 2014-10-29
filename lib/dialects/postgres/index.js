'use strict';

var _ = require('lodash')
  , Abstract = require('../abstract')
  , ConnectionManager = require('./connection-manager')
  , Query = require('./query');

var PostgresDialect = function(sequelize) {
  this.sequelize = sequelize;
  this.connectionManager = new ConnectionManager(this, sequelize);
  this.connectionManager.initPools();
};

PostgresDialect.prototype.supports = _.merge(_.cloneDeep(Abstract.prototype.supports), {
  'RETURNING': true,
  'DEFAULT VALUES': true,
  'EXCEPTION': true,
  schemas: true,
  lock: true,
  forShare: 'FOR SHARE',
  index: {
    concurrently: true,
    using: 2,
  }
});

PostgresDialect.prototype.Query = Query;

module.exports = PostgresDialect;
