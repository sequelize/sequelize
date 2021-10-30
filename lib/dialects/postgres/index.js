'use strict';

const _ = require('lodash');
const AbstractDialect = require('../abstract');
const ConnectionManager = require('./connection-manager');
const Query = require('./query');
const QueryGenerator = require('./query-generator');
const DataTypes = require('../../data-types').postgres;
const { PostgresQueryInterface } = require('./query-interface');

class PostgresDialect extends AbstractDialect {
  constructor(sequelize) {
    super();
    this.sequelize = sequelize;
    this.connectionManager = new ConnectionManager(this, sequelize);
    this.queryGenerator = new QueryGenerator({
      _dialect: this,
      sequelize
    });
    this.queryInterface = new PostgresQueryInterface(
      sequelize,
      this.queryGenerator
    );
  }
}

PostgresDialect.prototype.supports = _.merge(
  _.cloneDeep(AbstractDialect.prototype.supports),
  {
    'DEFAULT VALUES': true,
    EXCEPTION: true,
    'ON DUPLICATE KEY': false,
    'ORDER NULLS': true,
    returnValues: {
      returning: true
    },
    bulkDefault: true,
    schemas: true,
    lock: true,
    lockOf: true,
    lockKey: true,
    lockOuterJoinFailure: true,
    skipLocked: true,
    forShare: 'FOR SHARE',
    index: {
      concurrently: true,
      using: 2,
      where: true,
      functionBased: true,
      operator: true
    },
    inserts: {
      onConflictDoNothing: ' ON CONFLICT DO NOTHING',
      updateOnDuplicate: ' ON CONFLICT DO UPDATE SET'
    },
    NUMERIC: true,
    ARRAY: true,
    RANGE: true,
    GEOMETRY: true,
    REGEXP: true,
    GEOGRAPHY: true,
    JSON: true,
    JSONB: true,
    HSTORE: true,
    TSVECTOR: true,
    deferrableConstraints: true,
    searchPath: true
  }
);

PostgresDialect.prototype.defaultVersion = '9.5.0'; // minimum supported version
PostgresDialect.prototype.Query = Query;
PostgresDialect.prototype.DataTypes = DataTypes;
PostgresDialect.prototype.name = 'postgres';
PostgresDialect.prototype.TICK_CHAR = '"';
PostgresDialect.prototype.TICK_CHAR_LEFT = PostgresDialect.prototype.TICK_CHAR;
PostgresDialect.prototype.TICK_CHAR_RIGHT = PostgresDialect.prototype.TICK_CHAR;

module.exports = PostgresDialect;
module.exports.default = PostgresDialect;
module.exports.PostgresDialect = PostgresDialect;
