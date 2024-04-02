import type { Sequelize } from '@sequelize/core';
import { AbstractDialect } from '@sequelize/core';
import { createNamedParamBindCollector } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/sql.js';
import { getSynchronizedTypeKeys } from '@sequelize/utils';
import { registerMsSqlDbDataTypeParsers } from './_internal/data-types-db.js';
import * as DataTypes from './_internal/data-types-overrides.js';
import type { TediousModule } from './connection-manager.js';
import { MsSqlConnectionManager } from './connection-manager.js';
import { MsSqlQueryGenerator } from './query-generator.js';
import { MsSqlQueryInterface } from './query-interface.js';
import { MsSqlQuery } from './query.js';

export interface MsSqlDialectOptions {
  /**
   * The tedious library to use.
   * If not provided, the tedious npm library will be used.
   * Must be compatible with the tedious npm library API.
   *
   * Using this option should only be considered as a last resort,
   * as the Sequelize team cannot guarantee its compatibility.
   */
  tediousModule?: TediousModule;
}

const DIALECT_OPTION_NAMES = getSynchronizedTypeKeys<MsSqlDialectOptions>({
  tediousModule: undefined,
});

export class MsSqlDialect extends AbstractDialect<MsSqlDialectOptions> {
  static supports = AbstractDialect.extendSupport({
    'DEFAULT VALUES': true,
    'LIMIT ON UPDATE': true,
    migrations: false,
    returnValues: 'output',
    schemas: true,
    multiDatabases: true,
    autoIncrement: {
      identityInsert: true,
      defaultValue: false,
      update: false,
    },
    alterColumn: {
      unique: false,
    },
    constraints: {
      restrict: false,
      default: true,
      removeOptions: { ifExists: true },
    },
    index: {
      collate: false,
      type: true,
      using: false,
      where: true,
      include: true,
    },
    tmpTableTrigger: true,
    dataTypes: {
      JSON: true,
      // TODO: https://learn.microsoft.com/en-us/sql/t-sql/spatial-geography/spatial-types-geography?view=sql-server-ver16
      GEOGRAPHY: false,
      // TODO: https://learn.microsoft.com/en-us/sql/t-sql/spatial-geometry/spatial-types-geometry-transact-sql?view=sql-server-ver16
      GEOMETRY: false,
    },
    uuidV4Generation: true,
    jsonOperations: true,
    jsonExtraction: {
      unquoted: true,
      quoted: false,
    },
    tableHints: true,
    removeColumn: {
      ifExists: true,
    },
    renameTable: {
      changeSchemaAndTable: false,
    },
    createSchema: {
      authorization: true,
    },
    connectionTransactionMethods: true,
    settingIsolationLevelDuringTransaction: false,
    startTransaction: {
      useBegin: true,
    },
    delete: {
      limit: false,
    },
  });

  readonly connectionManager: MsSqlConnectionManager;
  readonly queryGenerator: MsSqlQueryGenerator;
  readonly queryInterface: MsSqlQueryInterface;
  readonly Query = MsSqlQuery;

  constructor(sequelize: Sequelize, options: MsSqlDialectOptions) {
    super({
      name: 'mssql',
      sequelize,
      dataTypeOverrides: DataTypes,
      identifierDelimiter: {
        start: '[',
        end: ']',
      },
      options,
      dataTypesDocumentationUrl:
        'https://msdn.microsoft.com/en-us/library/ms187752%28v=sql.110%29.aspx',
      // SQL Server 2017 Express (version 14), minimum supported version, all the way
      // up to the most recent version. When increasing this version, remember to
      // update also the minimum version in the documentation at
      //   https://github.com/sequelize/website/blob/main/docs/other-topics/dialect-specific-things.md
      // and set the relevant years for the mssql Docker images in the ci.yml file at
      //   .github/workflows/ci.yml
      minimumDatabaseVersion: '14.0.1000',
    });

    this.connectionManager = new MsSqlConnectionManager(this);
    this.queryGenerator = new MsSqlQueryGenerator(this);
    this.queryInterface = new MsSqlQueryInterface(this);

    registerMsSqlDbDataTypeParsers(this);
  }

  createBindCollector() {
    return createNamedParamBindCollector('@');
  }

  escapeBuffer(buffer: Buffer): string {
    const hex = buffer.toString('hex');

    return `0x${hex}`;
  }

  escapeString(value: string): string {
    // http://www.postgresql.org/docs/8.2/static/sql-syntax-lexical.html#SQL-SYNTAX-STRINGS
    // http://stackoverflow.com/q/603572/130598
    value = value.replaceAll("'", "''");

    return `N'${value}'`;
  }

  getDefaultSchema(): string {
    return 'dbo';
  }

  static getDefaultPort() {
    return 1433;
  }

  static getSupportedOptions() {
    return DIALECT_OPTION_NAMES;
  }
}
