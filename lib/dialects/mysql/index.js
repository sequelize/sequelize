'use strict';

var _ = require('lodash')
  , Abstract = require('../abstract')
  , ConnectionManager = require('./connection-manager')
  , Query = require('./query')
  , QueryGenerator = require('./query-generator')
  , DataTypes = require('../../data-types').mysql;

var MysqlDialect = function(sequelize) {
  this.sequelize = sequelize;
  this.connectionManager = new ConnectionManager(this, sequelize);
  this.connectionManager.initPools();
  this.QueryGenerator = _.extend({}, QueryGenerator, {
    options: sequelize.options,
    _dialect: this,
    sequelize
  });
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
    using: 1
  },
  ignoreDuplicates: ' IGNORE',
  updateOnDuplicate: true,
  indexViaAlter: true,
  NUMERIC: true,
  GEOMETRY: true
});

ConnectionManager.prototype.defaultVersion = '5.6.0';
MysqlDialect.prototype.Query = Query;
MysqlDialect.prototype.QueryGenerator = QueryGenerator;
MysqlDialect.prototype.DataTypes = DataTypes;
MysqlDialect.prototype.name = 'mysql';
MysqlDialect.prototype.TICK_CHAR = '`';
MysqlDialect.prototype.TICK_CHAR_LEFT = MysqlDialect.prototype.TICK_CHAR;
MysqlDialect.prototype.TICK_CHAR_RIGHT = MysqlDialect.prototype.TICK_CHAR;

module.exports = MysqlDialect;
