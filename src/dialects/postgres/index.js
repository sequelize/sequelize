'use strict';

import { createSpecifiedOrderedBindCollector } from '../../utils/sql';

const _ = require('lodash');
const { AbstractDialect } = require('../abstract');
const { PostgresConnectionManager } = require('./connection-manager');
const { PostgresQuery } = require('./query');
const { PostgresQueryGenerator } = require('./query-generator');
const DataTypes = require('../../data-types').postgres;
const { PostgresQueryInterface } = require('./query-interface');

export class PostgresDialect extends AbstractDialect {
  static supports = _.merge(_.cloneDeep(AbstractDialect.supports), {
    'DEFAULT VALUES': true,
    EXCEPTION: true,
    'ON DUPLICATE KEY': false,
    'ORDER NULLS': true,
    returnValues: {
      returning: true,
    },
    bulkDefault: true,
    schemas: true,
    databases: true,
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
      operator: true,
    },
    inserts: {
      onConflictDoNothing: ' ON CONFLICT DO NOTHING',
      updateOnDuplicate: ' ON CONFLICT DO UPDATE SET',
      conflictFields: true,
    },
    NUMERIC: true,
    ARRAY: true,
    RANGE: true,
    GEOMETRY: true,
    REGEXP: true,
    IREGEXP: true,
    GEOGRAPHY: true,
    JSON: true,
    JSONB: true,
    HSTORE: true,
    TSVECTOR: true,
    deferrableConstraints: true,
    searchPath: true,
    escapeStringConstants: true,
  });

  constructor(sequelize) {
    super();
    this.sequelize = sequelize;
    this.connectionManager = new PostgresConnectionManager(this, sequelize);
    this.queryGenerator = new PostgresQueryGenerator({
      dialect: this,
      sequelize,
    });
    this.queryInterface = new PostgresQueryInterface(
      sequelize,
      this.queryGenerator,
    );
  }

  createBindCollector() {
    return createSpecifiedOrderedBindCollector();
  }

  canBackslashEscape() {
    // postgres can use \ to escape if one of these is true:
    // - standard_conforming_strings is off
    // - the string is prefixed with E (out of scope for this method)

    return !this.sequelize.options.standardConformingStrings;
  }

  static getDefaultPort() {
    return 5432;
  }
}

PostgresDialect.prototype.defaultVersion = '9.5.0'; // minimum supported version
PostgresDialect.prototype.Query = PostgresQuery;
PostgresDialect.prototype.DataTypes = DataTypes;
PostgresDialect.prototype.name = 'postgres';
PostgresDialect.prototype.TICK_CHAR = '"';
PostgresDialect.prototype.TICK_CHAR_LEFT = PostgresDialect.prototype.TICK_CHAR;
PostgresDialect.prototype.TICK_CHAR_RIGHT = PostgresDialect.prototype.TICK_CHAR;
