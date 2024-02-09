import type { Sequelize } from '../../sequelize.js';
import { createNamedParamBindCollector } from '../../utils/sql';
import { AbstractDialect } from '../abstract';
import { SqliteConnectionManager } from './connection-manager';
import * as DataTypes from './data-types.js';
import { SqliteQuery } from './query';
import { SqliteQueryGenerator } from './query-generator';
import { SqliteQueryInterface } from './query-interface';

export class SqliteDialect extends AbstractDialect {
  static supports = AbstractDialect.extendSupport({
    'UNION ALL': false,
    'RIGHT JOIN': false,
    returnValues: 'returning',
    insert: {
      default: false,
      defaultValues: true,
      ignore: true,
      onConflict: true,
      returning: true,
    },
    index: {
      using: false,
      where: true,
      functionBased: true,
    },
    transactionOptions: {
      type: true,
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
}
