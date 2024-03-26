import type { Sequelize } from '@sequelize/core';
import { AbstractDialect } from '@sequelize/core';
import { createNamedParamBindCollector } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/sql.js';
import * as DataTypes from './_internal/data-types-overrides.js';
import { SqliteConnectionManager } from './connection-manager.js';
import { SqliteQueryGenerator } from './query-generator.js';
import { SqliteQueryInterface } from './query-interface.js';
import { SqliteQuery } from './query.js';

export class SqliteDialect extends AbstractDialect {
  static supports = AbstractDialect.extendSupport({
    DEFAULT: false,
    'DEFAULT VALUES': true,
    'UNION ALL': false,
    'RIGHT JOIN': false,
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

  readonly defaultVersion = '3.8.0';
  readonly Query = SqliteQuery;
  readonly TICK_CHAR_LEFT = '`';
  readonly TICK_CHAR_RIGHT = '`';
  readonly connectionManager: SqliteConnectionManager;
  readonly queryGenerator: SqliteQueryGenerator;
  readonly queryInterface: SqliteQueryInterface;
  readonly dataTypesDocumentationUrl = 'https://www.sqlite.org/datatype3.html';

  constructor(sequelize: Sequelize) {
    super(sequelize, DataTypes, 'sqlite');
    this.connectionManager = new SqliteConnectionManager(this);
    this.queryGenerator = new SqliteQueryGenerator(this);
    this.queryInterface = new SqliteQueryInterface(this);
  }

  createBindCollector() {
    return createNamedParamBindCollector('$');
  }

  getDefaultSchema(): string {
    // Our SQLite implementation doesn't support schemas
    return '';
  }

  static getDefaultPort() {
    return 0;
  }

  static getSupportedOptions() {
    return [];
  }
}
