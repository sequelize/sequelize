import type { Sequelize } from '@sequelize/core';
import { AbstractDialect } from '@sequelize/core';
import { createUnspecifiedOrderedBindCollector } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/sql.js';
import { getSynchronizedTypeKeys } from '@sequelize/utils';
import * as DataTypes from './_internal/data-types-overrides.js';
import type { SnowflakeSdkModule } from './connection-manager.js';
import { SnowflakeConnectionManager } from './connection-manager.js';
import { SnowflakeQueryGenerator } from './query-generator.js';
import { SnowflakeQueryInterface } from './query-interface.js';
import { SnowflakeQuery } from './query.js';

export interface SnowflakeDialectOptions {
  /**
   * The snowflake-sdk library to use.
   * If not provided, the snowflake-sdk npm library will be used.
   * Must be compatible with the snowflake-sdk npm library API.
   *
   * Using this option should only be considered as a last resort,
   * as the Sequelize team cannot guarantee its compatibility.
   */
  snowflakeSdkModule?: SnowflakeSdkModule;
}

const DIALECT_OPTION_NAMES = getSynchronizedTypeKeys<SnowflakeDialectOptions>({
  snowflakeSdkModule: undefined,
});

export class SnowflakeDialect extends AbstractDialect<SnowflakeDialectOptions> {
  static supports = AbstractDialect.extendSupport({
    'VALUES ()': true,
    'LIMIT ON UPDATE': true,
    lock: true,
    forShare: 'LOCK IN SHARE MODE',
    savepoints: false,
    isolationLevels: false,
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
      deferrable: true,
      check: false,
      removeOptions: { cascade: true },
    },
    indexViaAlter: true,
    indexHints: true,
    upserts: false,
    schemas: true,
    multiDatabases: true,
    dataTypes: {
      COLLATE_BINARY: true,
    },
    REGEXP: true,
    globalTimeZoneConfig: true,
    dropTable: {
      cascade: true,
    },
    createSchema: {
      comment: true,
      ifNotExists: true,
      replace: true,
    },
    dropSchema: {
      cascade: true,
      ifExists: true,
    },
    delete: {
      limit: false,
    },
  });

  readonly Query = SnowflakeQuery;
  readonly connectionManager: SnowflakeConnectionManager;
  readonly queryGenerator: SnowflakeQueryGenerator;
  readonly queryInterface: SnowflakeQueryInterface;

  constructor(sequelize: Sequelize, options: SnowflakeDialectOptions) {
    console.warn(
      'The Snowflake dialect is experimental and usage is at your own risk. Its development is exclusively community-driven and not officially supported by the maintainers.',
    );

    super({
      dataTypeOverrides: DataTypes,
      dataTypesDocumentationUrl: 'https://docs.snowflake.com/en/sql-reference/data-types.html',
      identifierDelimiter: '"',
      // TODO: fix the minimum supported version
      minimumDatabaseVersion: '5.7.0',
      name: 'snowflake',
      options,
      sequelize,
    });

    this.connectionManager = new SnowflakeConnectionManager(this);
    this.queryGenerator = new SnowflakeQueryGenerator(this);
    this.queryInterface = new SnowflakeQueryInterface(this);
  }

  createBindCollector() {
    return createUnspecifiedOrderedBindCollector();
  }

  getDefaultSchema(): string {
    return 'PUBLIC';
  }

  static getDefaultPort() {
    return 3306;
  }

  static getSupportedOptions() {
    return DIALECT_OPTION_NAMES;
  }
}
