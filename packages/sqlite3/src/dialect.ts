import type { Sequelize } from '@sequelize/core';
import { AbstractDialect } from '@sequelize/core';
import { createNamedParamBindCollector } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/sql.js';
import { getSynchronizedTypeKeys } from '@sequelize/utils';
import * as DataTypes from './_internal/data-types-overrides.js';
import type { Sqlite3Module, SqliteConnectionOptions } from './connection-manager.js';
import { SqliteConnectionManager } from './connection-manager.js';
import { SqliteQueryGenerator } from './query-generator.js';
import { SqliteQueryInterface } from './query-interface.js';
import { SqliteQuery } from './query.js';

export interface SqliteDialectOptions {
  /**
   * If set to false, SQLite will not enforce foreign keys.
   *
   * @default true
   */
  foreignKeys?: boolean;

  /**
   * The sqlite3 library to use.
   * If not provided, the sqlite3 npm library will be used.
   * Must be compatible with the sqlite3 npm library API.
   *
   * Using this option should only be considered as a last resort,
   * as the Sequelize team cannot guarantee its compatibility.
   */
  sqlite3Module?: Sqlite3Module;
}

const DIALECT_OPTION_NAMES = getSynchronizedTypeKeys<SqliteDialectOptions>({
  foreignKeys: undefined,
  sqlite3Module: undefined,
});

const CONNECTION_OPTION_NAMES = getSynchronizedTypeKeys<SqliteConnectionOptions>({
  storage: undefined,
  password: undefined,
  mode: undefined,
});

export class SqliteDialect extends AbstractDialect<SqliteDialectOptions, SqliteConnectionOptions> {
  static supports = AbstractDialect.extendSupport({
    DEFAULT: false,
    'DEFAULT VALUES': true,
    'UNION ALL': false,
    'RIGHT JOIN': false,
    returnValues: 'returning',
    inserts: {
      ignoreDuplicates: ' OR IGNORE',
      updateOnDuplicate: ' ON CONFLICT DO UPDATE SET',
      conflictFields: true,
      onConflictWhere: true,
    },
    index: {
      using: false,
      where: true,
      functionBased: true,
    },
    startTransaction: {
      useBegin: true,
      transactionType: true,
    },
    constraints: {
      foreignKeyChecksDisableable: true,
      add: false,
      remove: false,
    },
    groupedLimit: false,
    dataTypes: {
      CHAR: false,
      COLLATE_BINARY: true,
      CITEXT: true,
      DECIMAL: false,
      // sqlite3 doesn't give us a way to do sql type-based parsing, *and* returns bigints as js numbers.
      // issue: https://github.com/TryGhost/node-sqlite3/issues/922
      BIGINT: false,
      JSON: true,
    },
    // TODO: add support for JSON operations https://www.sqlite.org/json1.html (bundled in sqlite3)
    //  be careful: json_extract, ->, and ->> don't have the exact same meanings as mysql & mariadb
    jsonOperations: false,
    jsonExtraction: {
      unquoted: false,
      quoted: false,
    },
    truncate: {
      restartIdentity: false,
    },
    delete: {
      limit: false,
    },
  });

  readonly Query = SqliteQuery;
  readonly connectionManager: SqliteConnectionManager;
  readonly queryGenerator: SqliteQueryGenerator;
  readonly queryInterface: SqliteQueryInterface;

  constructor(sequelize: Sequelize, options: SqliteDialectOptions) {
    super({
      identifierDelimiter: '`',
      options,
      dataTypeOverrides: DataTypes,
      sequelize,
      minimumDatabaseVersion: '3.8.0',
      dataTypesDocumentationUrl: 'https://www.sqlite.org/datatype3.html',
      name: 'sqlite3',
    });

    this.connectionManager = new SqliteConnectionManager(this);
    this.queryGenerator = new SqliteQueryGenerator(this);
    this.queryInterface = new SqliteQueryInterface(this);
  }

  parseConnectionUrl(): SqliteConnectionOptions {
    throw new Error(
      'The "url" option is not supported in SQLite. Please use the "storage" option instead.',
    );
  }

  createBindCollector() {
    return createNamedParamBindCollector('$');
  }

  getDefaultSchema(): string {
    // Our SQLite implementation doesn't support schemas
    return '';
  }

  static getSupportedOptions() {
    return DIALECT_OPTION_NAMES;
  }

  static getSupportedConnectionOptions(): readonly string[] {
    return CONNECTION_OPTION_NAMES;
  }
}
