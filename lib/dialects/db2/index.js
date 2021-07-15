'use strict';

const _ = require('lodash');
const AbstractDialect = require('../abstract');
const ConnectionManager = require('./connection-manager');
const Query = require('./query');
const QueryGenerator = require('./query-generator');
const DataTypes = require('../../data-types').db2;
const { Db2QueryInterface } = require('./query-interface');

class Db2Dialect extends AbstractDialect {
  constructor(sequelize) {
    super();
    this.sequelize = sequelize;
    this.connectionManager = new ConnectionManager(this, sequelize);
    this.queryGenerator = new QueryGenerator({
      _dialect: this,
      sequelize
    });
    this.queryInterface = new Db2QueryInterface(sequelize, this.queryGenerator);
  }
}

Db2Dialect.prototype.supports = _.merge(_.cloneDeep(AbstractDialect.prototype.supports), {
  'DEFAULT': true,
  'DEFAULT VALUES': false,
  'VALUES ()': false,
  'LIMIT ON UPDATE': false,
  'ORDER NULLS': false,
  lock: false,
  transactions: true,
  migrations: false,
  returnValues: false,
  schemas: true,
  finalTable: true,
  autoIncrement: {
    identityInsert: false,
    defaultValue: false,
    update: true
  },
  constraints: {
    restrict: true,
    default: false
  },
  index: {
    collate: false,
    length: false,
    parser: false,
    type: false,
    using: false,
    where: true
  },
  NUMERIC: true,
  tmpTableTrigger: true
});

Db2Dialect.prototype.defaultVersion = '1.0.0'; // Db2 supported version comes here
Db2Dialect.prototype.Query = Query;
Db2Dialect.prototype.name = 'db2';
Db2Dialect.prototype.TICK_CHAR = '"';
Db2Dialect.prototype.TICK_CHAR_LEFT = '"';
Db2Dialect.prototype.TICK_CHAR_RIGHT = '"';
Db2Dialect.prototype.DataTypes = DataTypes;

module.exports = Db2Dialect;
