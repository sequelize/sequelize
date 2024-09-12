'use strict';

const _ = require('lodash');
const AbstractDialect = require('../abstract');
const ConnectionManager = require('./connection-manager');
const Query = require('./query');
const QueryGenerator = require('./query-generator');
const DataTypes = require('../../data-types').sqlite;
const { SQLiteQueryInterface } = require('./query-interface');

class SqliteDialect extends AbstractDialect {
  constructor(sequelize) {
    super();
    this.sequelize = sequelize;
    this.connectionManager = new ConnectionManager(this, sequelize);
    this.queryGenerator = new QueryGenerator({
      _dialect: this,
      sequelize
    });

    this.queryInterface = new SQLiteQueryInterface(
      sequelize,
      this.queryGenerator
    );
  }
}

SqliteDialect.prototype.supports = _.merge(
  _.cloneDeep(AbstractDialect.prototype.supports),
  {
    DEFAULT: false,
    'DEFAULT VALUES': true,
    'UNION ALL': false,
    'RIGHT JOIN': false,
    inserts: {
      ignoreDuplicates: ' OR IGNORE',
      updateOnDuplicate: ' ON CONFLICT DO UPDATE SET',
      conflictFields: true,
      onConflictWhere: true
    },
    index: {
      using: false,
      where: true,
      functionBased: true
    },
    transactionOptions: {
      type: true
    },
    constraints: {
      addConstraint: false,
      dropConstraint: false
    },
    groupedLimit: false,
    JSON: true
  }
);

SqliteDialect.prototype.defaultVersion = '3.8.0'; // minimum supported version
SqliteDialect.prototype.Query = Query;
SqliteDialect.prototype.DataTypes = DataTypes;
SqliteDialect.prototype.name = 'sqlite';
SqliteDialect.prototype.TICK_CHAR = '`';
SqliteDialect.prototype.TICK_CHAR_LEFT = SqliteDialect.prototype.TICK_CHAR;
SqliteDialect.prototype.TICK_CHAR_RIGHT = SqliteDialect.prototype.TICK_CHAR;

module.exports = SqliteDialect;
module.exports.SqliteDialect = SqliteDialect;
module.exports.default = SqliteDialect;
