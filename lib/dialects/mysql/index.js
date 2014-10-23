'use strict';

var _ = require('lodash')
  , Abstract = require('../abstract')
  , ConnectionManager = require('./connection-manager')
  , Query = require('./query');

var MysqlDialect = function(sequelize) {
  this.sequelize = sequelize;
  this.connectionManager = new ConnectionManager(this, sequelize);
  this.connectionManager.initPools();
};

MysqlDialect.prototype.supports = _.merge(_.cloneDeep(Abstract.prototype.supports), {
  'VALUES ()': true,
  'LIMIT ON UPDATE': true,
  'IGNORE': ' IGNORE',
  lock: true,
  forShare: 'LOCK IN SHARE MODE',
  index: {
    collate: false,
    length: true,
    parser: true,
    type: true,
    using: 1,
  }
});

MysqlDialect.prototype.Query = Query;

module.exports = MysqlDialect;
