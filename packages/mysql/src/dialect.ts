import type { Sequelize } from '@sequelize/core';
import { AbstractDialect } from '@sequelize/core';
import type { SupportableNumericOptions } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/dialect.js';
import { parseCommonConnectionUrlOptions } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/connection-options.js';
import {
  createUnspecifiedOrderedBindCollector,
  escapeMysqlMariaDbString,
} from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/sql.js';
import { getSynchronizedTypeKeys } from '@sequelize/utils';
import {
  BOOLEAN_CONNECTION_OPTION_NAMES,
  CONNECTION_OPTION_NAMES,
  NUMBER_CONNECTION_OPTION_NAMES,
  STRING_CONNECTION_OPTION_NAMES,
} from './_internal/connection-options.js';
import { registerMySqlDbDataTypeParsers } from './_internal/data-types-db.js';
import * as DataTypes from './_internal/data-types-overrides.js';
import type { MySql2Module, MySqlConnectionOptions } from './connection-manager.js';
import { MySqlConnectionManager } from './connection-manager.js';
import { MySqlQueryGenerator } from './query-generator.js';
import { MySqlQueryInterface } from './query-interface.js';
import { MySqlQuery } from './query.js';

export interface MySqlDialectOptions {
  /**
   * The mysql2 library to use.
   * If not provided, the mysql2 npm library will be used.
   * Must be compatible with the mysql2 npm library API.
   *
   * Using this option should only be considered as a last resort,
   * as the Sequelize team cannot guarantee its compatibility.
   */
  mysql2Module?: MySql2Module;

  /**
   * Show warnings if there are any when executing a query
   */
  showWarnings?: boolean | undefined;
}

const DIALECT_OPTION_NAMES = getSynchronizedTypeKeys<MySqlDialectOptions>({
  mysql2Module: undefined,
  showWarnings: undefined,
});

const numericOptions: SupportableNumericOptions = {
  zerofill: true,
  unsigned: true,
};

export class MySqlDialect extends AbstractDialect<MySqlDialectOptions, MySqlConnectionOptions> {
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

  constructor(sequelize: Sequelize, options: MySqlDialectOptions) {
    super({
      sequelize,
      options,
      dataTypeOverrides: DataTypes,
      minimumDatabaseVersion: '8.0.19',
      identifierDelimiter: '`',
      dataTypesDocumentationUrl: 'https://dev.mysql.com/doc/refman/8.0/en/data-types.html',
      name: 'mysql',
    });

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
    return this.sequelize.options.replication.write.database ?? '';
  }

  parseConnectionUrl(url: string): MySqlConnectionOptions {
    return parseCommonConnectionUrlOptions<MySqlConnectionOptions>({
      url,
      allowedProtocols: ['mysql'],
      hostname: 'host',
      port: 'port',
      pathname: 'database',
      username: 'user',
      password: 'password',
      stringSearchParams: STRING_CONNECTION_OPTION_NAMES,
      booleanSearchParams: BOOLEAN_CONNECTION_OPTION_NAMES,
      numberSearchParams: NUMBER_CONNECTION_OPTION_NAMES,
    });
  }

  static getSupportedOptions() {
    return DIALECT_OPTION_NAMES;
  }

  static getSupportedConnectionOptions() {
    return CONNECTION_OPTION_NAMES;
  }
}
