'use strict';

var _ = require('lodash')
  , Abstract = require('../abstract')
  , ConnectionManager = require('./connection-manager')
  , Query = require('./query')
  , QueryGenerator = require('./query-generator')
  , DataTypes = require('./data-types');

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
  schemas: true,
  autosemi: true,
  index: {
    using: false,
    collate: false
  }
});

OracleDialect.prototype.Query = Query;
OracleDialect.prototype.DataTypes = DataTypes;
OracleDialect.prototype.QueryGenerator = QueryGenerator;
OracleDialect.prototype.name = 'oracle';
OracleDialect.prototype.TICK_CHAR = '"';
OracleDialect.prototype.TICK_CHAR_LEFT = OracleDialect.prototype.TICK_CHAR;
OracleDialect.prototype.TICK_CHAR_RIGHT = OracleDialect.prototype.TICK_CHAR;

module.exports = OracleDialect;
