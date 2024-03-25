import type { Sequelize } from '@sequelize/core';
import { AbstractDialect } from '@sequelize/core';
import type { SupportableNumericOptions } from '@sequelize/core/_non-semver-use-at-your-own-risk_/dialects/abstract/index.js';
import {
  createUnspecifiedOrderedBindCollector,
  escapeMysqlMariaDbString,
} from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/sql.js';
import { registerMySqlDbDataTypeParsers } from './_internal/data-types-db.js';
import * as DataTypes from './_internal/data-types-overrides.js';
import { MySqlConnectionManager } from './connection-manager.js';
import { MySqlQueryGenerator } from './query-generator.js';
import { MySqlQueryInterface } from './query-interface.js';
import { MySqlQuery } from './query.js';

const numericOptions: SupportableNumericOptions = {
  zerofill: true,
  unsigned: true,
};

export class MySqlDialect extends AbstractDialect {
  static supports = AbstractDialect.extendSupport({
    'VALUES ()': true,
    'LIMIT ON UPDATE': true,
    lock: true,
    forShare: 'LOCK IN SHARE MODE',
    settingIsolationLevelDuringTransaction: false,
    schemas: true,
    inserts: {
      ignoreDuplicates: ' IGNORE',
      updateOnDuplicate: ' ON DUPLICATE KEY UPDATE',
    },
    index: {
      collate: false,
      length: true,
      parser: true,
      type: true,
      using: 1,
    },
    constraints: {
      foreignKeyChecksDisableable: true,
    },
    indexViaAlter: true,
    indexHints: true,
    dataTypes: {
      COLLATE_BINARY: true,
      GEOMETRY: true,
      INTS: numericOptions,
      FLOAT: { ...numericOptions, scaleAndPrecision: true },
      REAL: { ...numericOptions, scaleAndPrecision: true },
      DOUBLE: { ...numericOptions, scaleAndPrecision: true },
      DECIMAL: numericOptions,
      JSON: true,
    },
    jsonOperations: true,
    jsonExtraction: {
      unquoted: true,
      quoted: true,
    },
    REGEXP: true,
    uuidV1Generation: true,
    globalTimeZoneConfig: true,
    maxExecutionTimeHint: {
      select: true,
    },
    createSchema: {
      charset: true,
      collate: true,
      ifNotExists: true,
    },
    dropSchema: {
      ifExists: true,
    },
    startTransaction: {
      readOnly: true,
    },
  });

  readonly connectionManager: MySqlConnectionManager;
  readonly queryGenerator: MySqlQueryGenerator;
  readonly queryInterface: MySqlQueryInterface;
  readonly Query = MySqlQuery;
  readonly dataTypesDocumentationUrl = 'https://dev.mysql.com/doc/refman/8.0/en/data-types.html';

  // minimum supported version
  readonly defaultVersion = '8.0.19';
  readonly TICK_CHAR_LEFT = '`';
  readonly TICK_CHAR_RIGHT = '`';

  constructor(sequelize: Sequelize) {
    super(sequelize, DataTypes, 'mysql');
    this.connectionManager = new MySqlConnectionManager(this);
    this.queryGenerator = new MySqlQueryGenerator(this);
    this.queryInterface = new MySqlQueryInterface(this);

    registerMySqlDbDataTypeParsers(this);
  }

  createBindCollector() {
    return createUnspecifiedOrderedBindCollector();
  }

  escapeString(value: string): string {
    return escapeMysqlMariaDbString(value);
  }

  escapeJson(value: unknown): string {
    return `CAST(${super.escapeJson(value)} AS JSON)`;
  }

  canBackslashEscape() {
    return true;
  }

  getDefaultSchema(): string {
    return this.sequelize.options.database ?? '';
  }

  static getDefaultPort() {
    return 3306;
  }

  static getSupportedOptions() {
    return [];
  }
}
