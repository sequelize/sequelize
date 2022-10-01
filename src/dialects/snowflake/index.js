'use strict';

import { createUnspecifiedOrderedBindCollector } from '../../utils/sql';

const _ = require('lodash');
const { AbstractDialect } = require('../abstract');
const { SnowflakeConnectionManager } = require('./connection-manager');
const { SnowflakeQuery } = require('./query');
const { SnowflakeQueryGenerator } = require('./query-generator');
const DataTypes = require('../../data-types').snowflake;
const { SnowflakeQueryInterface } = require('./query-interface');

export class SnowflakeDialect extends AbstractDialect {
  static supports = _.merge(_.cloneDeep(AbstractDialect.supports), {
    'VALUES ()': true,
    'LIMIT ON UPDATE': true,
    lock: true,
    forShare: 'LOCK IN SHARE MODE',
    settingIsolationLevelDuringTransaction: false,
    inserts: {
      ignoreDuplicates: ' IGNORE',
      // disable for now, but could be enable by approach below
      // https://stackoverflow.com/questions/54828745/how-to-migrate-on-conflict-do-nothing-from-postgresql-to-snowflake
      // updateOnDuplicate: true
    },
    index: {
      collate: false,
      length: true,
      parser: true,
      type: true,
      using: 1,
    },
    constraints: {
      dropConstraint: false,
      check: false,
    },
    indexViaAlter: true,
    indexHints: true,
    NUMERIC: true,
    // disable for now, need more work to enable the GEOGRAPHY MAPPING
    // GEOMETRY: true,
    // JSON: true,
    REGEXP: true,
    schemas: true,
    databases: true,
    milliseconds: false,
  });

  constructor(sequelize) {
    super();
    this.sequelize = sequelize;
    this.connectionManager = new SnowflakeConnectionManager(this, sequelize);
    this.queryGenerator = new SnowflakeQueryGenerator({
      dialect: this,
      sequelize,
    });
    this.queryInterface = new SnowflakeQueryInterface(sequelize, this.queryGenerator);
  }

  createBindCollector() {
    return createUnspecifiedOrderedBindCollector();
  }

  static getDefaultPort() {
    return 3306;
  }
}

SnowflakeDialect.prototype.defaultVersion = '5.7.0';
SnowflakeDialect.prototype.Query = SnowflakeQuery;
SnowflakeDialect.prototype.QueryGenerator = SnowflakeQueryGenerator;
SnowflakeDialect.prototype.DataTypes = DataTypes;
SnowflakeDialect.prototype.name = 'snowflake';
SnowflakeDialect.prototype.TICK_CHAR = '"';
SnowflakeDialect.prototype.TICK_CHAR_LEFT = SnowflakeDialect.prototype.TICK_CHAR;
SnowflakeDialect.prototype.TICK_CHAR_RIGHT = SnowflakeDialect.prototype.TICK_CHAR;
