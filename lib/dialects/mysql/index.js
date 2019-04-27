'use strict';

const _ = require('lodash');
const AbstractDialect = require('../abstract');
const ConnectionManager = require('./connection-manager');
const Query = require('./query');
const QueryGenerator = require('./query-generator');
const DataTypes = require('../../data-types').mysql;

class MysqlDialect extends AbstractDialect {
  constructor(sequelize) {
    super();
    this.sequelize = sequelize;
    this.connectionManager = new ConnectionManager(this, sequelize);
    this.QueryGenerator = new QueryGenerator({
      _dialect: this,
      sequelize
    });
  }
}

MysqlDialect.prototype.supports = _.merge(_.cloneDeep(AbstractDialect.prototype.supports), {
  'VALUES ()': true,
  'LIMIT ON UPDATE': true,
  lock: true,
  forShare: 'LOCK IN SHARE MODE',
  inserts: {
    ignoreDuplicates: ' IGNORE',
    updateOnDuplicate: true
  },
  index: {
    collate: false,
    length: true,
    parser: true,
    type: true,
    using: 1
  },
  constraints: {
    dropConstraint: false,
    check: false
  },
  indexViaAlter: true,
  indexHints: true,
  NUMERIC: true,
  GEOMETRY: true,
  JSON: true,
  REGEXP: true
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
