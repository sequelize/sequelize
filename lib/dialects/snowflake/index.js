'use strict';

const _ = require('lodash');
const AbstractDialect = require('../abstract');
const ConnectionManager = require('./connection-manager');
const Query = require('./query');
const QueryGenerator = require('./query-generator');
const DataTypes = require('../../data-types').snowflake;
const { SnowflakeQueryInterface } = require('./query-interface');

class SnowflakeDialect extends AbstractDialect {
  constructor(sequelize) {
    super();
    this.sequelize = sequelize;
    this.connectionManager = new ConnectionManager(this, sequelize);
    this.queryGenerator = new QueryGenerator({
      _dialect: this,
      sequelize
    });
    this.queryInterface = new SnowflakeQueryInterface(sequelize, this.queryGenerator);
  }
}

SnowflakeDialect.prototype.supports = _.merge(_.cloneDeep(AbstractDialect.prototype.supports), {
  'VALUES ()': true,
  'LIMIT ON UPDATE': true,
  lock: true,
  forShare: 'LOCK IN SHARE MODE',
  settingIsolationLevelDuringTransaction: false,
  inserts: {
    ignoreDuplicates: ' IGNORE',
    // disable for now, but could be enable by approach below
    // https://stackoverflow.com/questions/54828745/how-to-migrate-on-conflict-do-nothing-from-postgresql-to-snowflake
    updateOnDuplicate: false
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
  // disable for now, need more work to enable the GEOGRAPHY MAPPING
  GEOMETRY: false,
  JSON: false,
  REGEXP: true,
  schemas: true
});

SnowflakeDialect.prototype.defaultVersion = '5.7.0';
SnowflakeDialect.prototype.Query = Query;
SnowflakeDialect.prototype.QueryGenerator = QueryGenerator;
SnowflakeDialect.prototype.DataTypes = DataTypes;
SnowflakeDialect.prototype.name = 'snowflake';
SnowflakeDialect.prototype.TICK_CHAR = '"';
SnowflakeDialect.prototype.TICK_CHAR_LEFT = SnowflakeDialect.prototype.TICK_CHAR;
SnowflakeDialect.prototype.TICK_CHAR_RIGHT = SnowflakeDialect.prototype.TICK_CHAR;

module.exports = SnowflakeDialect;
