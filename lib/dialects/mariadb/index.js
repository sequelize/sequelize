'use strict';

const _ = require('lodash');
const AbstractDialect = require('../abstract');
const ConnectionManager = require('./connection-manager');
const Query = require('./query');
const QueryGenerator = require('./query-generator');
const { MySQLQueryInterface } = require('../mysql/query-interface');
const DataTypes = require('../../data-types').mariadb;

class MariadbDialect extends AbstractDialect {
  constructor(sequelize) {
    super();
    this.sequelize = sequelize;
    this.connectionManager = new ConnectionManager(this, sequelize);
    this.queryGenerator = new QueryGenerator({
      _dialect: this,
      sequelize
    });
    this.queryInterface = new MySQLQueryInterface(
      sequelize,
      this.queryGenerator
    );
  }
}

MariadbDialect.prototype.supports = _.merge(
  _.cloneDeep(AbstractDialect.prototype.supports),
  {
    'VALUES ()': true,
    'LIMIT ON UPDATE': true,
    lock: true,
    forShare: 'LOCK IN SHARE MODE',
    settingIsolationLevelDuringTransaction: false,
    schemas: true,
    inserts: {
      ignoreDuplicates: ' IGNORE',
      updateOnDuplicate: ' ON DUPLICATE KEY UPDATE'
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
  }
);

MariadbDialect.prototype.defaultVersion = '10.1.44'; // minimum supported version
MariadbDialect.prototype.Query = Query;
MariadbDialect.prototype.QueryGenerator = QueryGenerator;
MariadbDialect.prototype.DataTypes = DataTypes;
MariadbDialect.prototype.name = 'mariadb';
MariadbDialect.prototype.TICK_CHAR = '`';
MariadbDialect.prototype.TICK_CHAR_LEFT = MariadbDialect.prototype.TICK_CHAR;
MariadbDialect.prototype.TICK_CHAR_RIGHT = MariadbDialect.prototype.TICK_CHAR;

module.exports = MariadbDialect;
