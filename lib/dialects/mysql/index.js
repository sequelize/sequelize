'use strict';

var _ = require('lodash')
  , Abstract = require('../abstract')
  , ConnectionManager = require('./connection-manager')
  , Query = require('./query');

var MysqlDialect = function(sequelize) {
  this.sequelize = sequelize;
  this.connectionManager = new ConnectionManager(this, sequelize);
};

MysqlDialect.prototype.supports = _.defaults({
  'VALUES ()': true,
  'LIMIT ON UPDATE': true,
  lock: true,
  forShare: 'LOCK IN SHARE MODE'
}, Abstract.prototype.supports);

MysqlDialect.prototype.Query = Query;

module.exports = MysqlDialect;