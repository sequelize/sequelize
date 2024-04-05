import type { Sequelize } from '@sequelize/core';
import { AbstractDialect } from '@sequelize/core';
import type { SupportableNumericOptions } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/index.js';
import {
  createUnspecifiedOrderedBindCollector,
  escapeMysqlMariaDbString,
} from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/sql.js';
import { registerMariaDbDbDataTypeParsers } from './_internal/data-types-db.js';
import * as DataTypes from './_internal/data-types-overrides.js';
import { MariaDbConnectionManager } from './connection-manager.js';
import { MariaDbQueryGenerator } from './query-generator.js';
import { MariaDbQueryInterface } from './query-interface.js';
import { MariaDbQuery } from './query.js';

const numericOptions: SupportableNumericOptions = {
  zerofill: true,
  unsigned: true,
};

export class MariaDbDialect extends AbstractDialect {
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
      removeOptions: { ifExists: true },
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
    REGEXP: true,
    jsonOperations: true,
    jsonExtraction: {
      unquoted: true,
      quoted: true,
    },
    uuidV1Generation: true,
    globalTimeZoneConfig: true,
    removeColumn: {
      ifExists: true,
    },
    createSchema: {
      charset: true,
      collate: true,
      // TODO [>=2024-06-19]: uncomment when MariaDB 10.5 is oldest supported version
      // comment: true,
      ifNotExists: true,
      replace: true,
    },
    dropSchema: {
      ifExists: true,
    },
    startTransaction: {
      readOnly: true,
    },
  });

  readonly TICK_CHAR_LEFT = '`';
  readonly TICK_CHAR_RIGHT = '`';
  readonly defaultVersion = '10.4.30'; // minimum supported version
  readonly dataTypesDocumentationUrl = 'https://mariadb.com/kb/en/library/resultset/#field-types';

  readonly queryGenerator: MariaDbQueryGenerator;
  readonly connectionManager: MariaDbConnectionManager;
  readonly queryInterface: MariaDbQueryInterface;

  readonly Query = MariaDbQuery;

  constructor(sequelize: Sequelize) {
    super(sequelize, DataTypes, 'mariadb');
    this.connectionManager = new MariaDbConnectionManager(this);
    this.queryGenerator = new MariaDbQueryGenerator(this);
    this.queryInterface = new MariaDbQueryInterface(this);

    registerMariaDbDbDataTypeParsers(this);
  }

  createBindCollector() {
    return createUnspecifiedOrderedBindCollector();
  }

  escapeString(value: string) {
    return escapeMysqlMariaDbString(value);
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
