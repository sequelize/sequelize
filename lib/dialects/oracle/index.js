'use strict';

const _ = require('lodash');
const AbstractDialect = require('../abstract');
const ConnectionManager = require('./connection-manager');
const Query = require('./query');
const QueryGenerator = require('./query-generator');
const DataTypes = require('../../data-types').oracle;

class OracleDialect extends AbstractDialect {

  constructor(sequelize) {
    super();
    this.sequelize = sequelize;
    this.connectionManager = new ConnectionManager(this, sequelize);
    this.connectionManager.initPools();
    this.QueryGenerator = _.extend({}, QueryGenerator, {
      options: sequelize.options,
      _dialect: this,
      sequelize
    });
  }
}

OracleDialect.prototype.supports = _.merge(_.cloneDeep(AbstractDialect.prototype.supports), {
  'VALUES ()': true,
  'LIMIT ON UPDATE': true,
  'IGNORE': ' IGNORE',
  lock: false,
  forShare: ' IN SHARE MODE',
  index: {
    collate: false,
    length: false,
    parser: false,
    type: false,
    using: false
  },
  constraints: {
    restrict: false
  },
  returnValues: false,
  'ORDER NULLS': true,
  ignoreDuplicates: ' IGNORE',
  schemas: true,
  updateOnDuplicate: true,
  indexViaAlter: false,
  NUMERIC: true,
  upserts : false,
  GEOMETRY: false
});

ConnectionManager.prototype.defaultVersion = '12.1.0.2.0';
OracleDialect.prototype.Query = Query;
OracleDialect.prototype.QueryGenerator = QueryGenerator;
OracleDialect.prototype.DataTypes = DataTypes;
OracleDialect.prototype.name = 'oracle';
OracleDialect.prototype.TICK_CHAR = '';
OracleDialect.prototype.TICK_CHAR_LEFT = OracleDialect.prototype.TICK_CHAR;
OracleDialect.prototype.TICK_CHAR_RIGHT = OracleDialect.prototype.TICK_CHAR;

module.exports = OracleDialect;
