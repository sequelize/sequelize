'use strict';

var _ = require('lodash')
  , Abstract = require('../abstract')
  , ConnectionManager = require('./connection-manager')
  , Query = require('./query')
  , QueryGenerator = require('./query-generator')
  , DataTypes = require('../../data-types').oracle;

var OracleDialect = function(sequelize) {
  this.sequelize = sequelize;
  this.connectionManager = new ConnectionManager(this, sequelize);
  this.connectionManager.initPools();
  this.QueryGenerator = _.extend({}, QueryGenerator, {
    options: sequelize.options,
    _dialect: this,
    sequelize: sequelize
  });
};

OracleDialect.prototype.supports = _.merge(_.cloneDeep(Abstract.prototype.supports), {
  'VALUES ()': true,
  'LIMIT ON UPDATE': true,
  'IGNORE': ' IGNORE',
  lock: true,
  forShare: ' IN SHARE MODE',
  index: {
    collate: false,
    length: false,
    parser: false,
    type: false,
    using: false,
  },
  returnValues: {
    output: true
  },
  ignoreDuplicates: ' IGNORE',
  schemas: true,
  updateOnDuplicate: true,
  indexViaAlter: false,
  NUMERIC: false,
  GEOMETRY: false
});

ConnectionManager.prototype.defaultVersion = '12.1.0.2.0';
OracleDialect.prototype.Query = Query;
OracleDialect.prototype.QueryGenerator = QueryGenerator;
OracleDialect.prototype.DataTypes = DataTypes;
OracleDialect.prototype.name = 'oracle';
OracleDialect.prototype.TICK_CHAR = '"';
OracleDialect.prototype.TICK_CHAR_LEFT = OracleDialect.prototype.TICK_CHAR;
OracleDialect.prototype.TICK_CHAR_RIGHT = OracleDialect.prototype.TICK_CHAR;

module.exports = OracleDialect;
