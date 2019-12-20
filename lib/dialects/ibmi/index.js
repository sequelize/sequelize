'use strict';

const _ = require('lodash');
const AbstractDialect = require('../abstract');
const ConnectionManager = require('./connection-manager');
const Query = require('./query');
const QueryGenerator = require('./query-generator');
const DataTypes = require('../../data-types').ibmi;

class IBMiDialect extends AbstractDialect {
  constructor(sequelize) {
    super();
    this.sequelize = sequelize;
    this.connectionManager = new ConnectionManager(this, sequelize);
    this.QueryGenerator = new QueryGenerator({
      _dialect: this,
      sequelize
    });
    this.supports.autoIncrement.defaultValue = true;
    this.supports.autoIncrement.update = true;
    this.supports.schemas = true;
  }
}

IBMiDialect.prototype.supports = _.merge(_.cloneDeep(AbstractDialect.prototype.supports), {
  'DEFAULT': true,
  'DEFAULT VALUES': false,
  'UNION ALL': true,
  'VALUES ()': true,
  'ON DUPLICATE KEY': false,
  transactions: false,
  transactionOptions: {
    type: false
  },

  inserts: {
  },
  bulkDefault: true,
  index: {
    using: false,
    where: true,
    functionBased: true
  },
  constraints: {
    addConstraint: true,
    dropConstraint: true
  },
  joinTableDependent: false,
  indexViaAlter: true,
  groupedLimit: false,
  JSON: false,
  upserts: false
});

ConnectionManager.prototype.defaultVersion = '3.8.0';
IBMiDialect.prototype.Query = Query;
IBMiDialect.prototype.DataTypes = DataTypes;
IBMiDialect.prototype.name = 'ibmi';
IBMiDialect.prototype.TICK_CHAR = '"';
IBMiDialect.prototype.TICK_CHAR_LEFT = IBMiDialect.prototype.TICK_CHAR;
IBMiDialect.prototype.TICK_CHAR_RIGHT = IBMiDialect.prototype.TICK_CHAR;

module.exports = IBMiDialect;
module.exports.IBMiDialect = IBMiDialect;
module.exports.default = IBMiDialect;
