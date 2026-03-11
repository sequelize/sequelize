import type { Sequelize } from '@sequelize/core';
import { AbstractDialect } from '@sequelize/core';
import { createUnspecifiedOrderedBindCollector } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/sql.js';
import { getSynchronizedTypeKeys } from '@sequelize/utils';
import * as DataTypes from './_internal/data-types-overrides.js';
import type { FirebirdConnectionOptions } from './connection-manager.js';
import { FirebirdConnectionManager } from './connection-manager.js';
import { FirebirdQueryGenerator } from './query-generator.js';
import { FirebirdQueryInterface } from './query-interface.js';
import { FirebirdQuery } from './query.js';

export interface FirebirdDialectOptions {
  /**
   * The node-firebird library to use.
   * If not provided, the node-firebird npm library will be used.
   * Must be compatible with the node-firebird npm library API.
   *
   * Using this option should only be considered as a last resort,
   * as the Sequelize team cannot guarantee its compatibility.
   */
  firebirdModule?: object;
}

const DIALECT_OPTION_NAMES = getSynchronizedTypeKeys<FirebirdDialectOptions>({
  firebirdModule: undefined,
});

const CONNECTION_OPTION_NAMES = getSynchronizedTypeKeys<FirebirdConnectionOptions>({
  host: undefined,
  port: undefined,
  database: undefined,
  user: undefined,
  password: undefined,
  role: undefined,
  charset: undefined,
  pageSize: undefined,
  retryConnectionInterval: undefined,
  blobAsText: undefined,
  lowercase_keys: undefined,
});

export class FirebirdDialect extends AbstractDialect<
  FirebirdDialectOptions,
  FirebirdConnectionOptions
> {
  static supports = AbstractDialect.extendSupport({
    // Firebird does not use DEFAULT keyword standalone
    DEFAULT: false,
    'DEFAULT VALUES': true,
    // Firebird supports UNION ALL
    'UNION ALL': true,
    'RIGHT JOIN': true,
    // No native RETURNING except on INSERT
    returnValues: 'returning',
    inserts: {
      // No native INSERT OR IGNORE / ON DUPLICATE KEY
      ignoreDuplicates: '',
      updateOnDuplicate: false,
      conflictFields: false,
      onConflictWhere: false,
    },
    index: {
      // No USING clause in Firebird indexes
      using: false,
      where: false,
      functionBased: false,
      collate: false,
    },
    startTransaction: {
      useBegin: true,
      transactionType: false,
    },
    constraints: {
      foreignKeyChecksDisableable: false,
      add: true,
      remove: false,
    },
    groupedLimit: false,
    dataTypes: {
      // Firebird 3+ has native BOOLEAN
      // BOOLEAN: true,
      // No native JSON column
      JSON: false,
      // Firebird has BIGINT
      BIGINT: true,
      // No CHAR type preferred; use VARCHAR
      CHAR: true,
      // DECIMAL: true,
    },
    jsonOperations: false,
    jsonExtraction: {
      unquoted: false,
      quoted: false,
    },
    truncate: {
      // Firebird has no TRUNCATE TABLE
      restartIdentity: false,
    },
    delete: {
      // Firebird does not support LIMIT in DELETE
      limit: false,
    },
  });

  readonly Query = FirebirdQuery;
  readonly connectionManager: FirebirdConnectionManager;
  readonly queryGenerator: FirebirdQueryGenerator;
  readonly queryInterface: FirebirdQueryInterface;
  /*
  */

  constructor(sequelize: Sequelize, options: FirebirdDialectOptions) {
    super({
      identifierDelimiter: '',
      options,
      dataTypeOverrides: DataTypes,
      sequelize,
      minimumDatabaseVersion: '3.0.0',
      dataTypesDocumentationUrl:
        'https://firebirdsql.org/refdocs/langrefupd25-datatypes.html',
      name: 'firebird' as any,
    });

    this.connectionManager = new FirebirdConnectionManager(this);
    this.queryGenerator = new FirebirdQueryGenerator(this);
    this.queryInterface = new FirebirdQueryInterface(this);
  }

  createBindCollector() {
    // Firebird uses positional ? parameters
    return createUnspecifiedOrderedBindCollector();
  }

  parseConnectionUrl(url: string): FirebirdConnectionOptions {
    // firebird://user:password@host:port/database
    const parsed = new URL(url);

    return {
      host: parsed.hostname || 'localhost',
      port: parsed.port ? Number(parsed.port) : 3050,
      database: parsed.pathname.slice(1), // remove leading /
      user: parsed.username || 'SYSDBA',
      password: parsed.password || '',
    };
  }

  getDefaultSchema(): string {
    // Firebird does not support schemas
    return '';
  }

  static getSupportedOptions() {
    return DIALECT_OPTION_NAMES;
  }

  static getSupportedConnectionOptions(): readonly string[] {
    return CONNECTION_OPTION_NAMES;
  }
}
