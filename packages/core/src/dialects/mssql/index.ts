import type { Sequelize } from '../../sequelize.js';
import { createNamedParamBindCollector } from '../../utils/sql';
import { AbstractDialect } from '../abstract';
import { MsSqlConnectionManager } from './connection-manager';
import * as DataTypes from './data-types';
import { registerMsSqlDbDataTypeParsers } from './data-types.db.js';
import { MsSqlQueryGenerator } from './query-generator';
import { MsSqlQueryInterface } from './query-interface';
import { MsSqlQuery } from './query.js';

export class MssqlDialect extends AbstractDialect {
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
    jsonOperations: true,
    jsonExtraction: {
      unquoted: true,
      quoted: false,
    },
    tableHints: true,
    removeColumn: {
      ifExists: true,
    },
  });

  readonly connectionManager: MsSqlConnectionManager;
  readonly queryGenerator: MsSqlQueryGenerator;
  readonly queryInterface: MsSqlQueryInterface;
  readonly Query = MsSqlQuery;
  readonly dataTypesDocumentationUrl = 'https://msdn.microsoft.com/en-us/library/ms187752%28v=sql.110%29.aspx';

  // SQL Server 2017 Express (version 14), minimum supported version, all the way
  // up to the most recent version. When increasing this version, remember to
  // update also the minimum version in the documentation at
  //   https://github.com/sequelize/website/blob/main/docs/other-topics/dialect-specific-things.md
  // and set the relevant years for the mssql Docker images in the ci.yml file at
  //   .github/workflows/ci.yml
  // minimum supported version
  readonly defaultVersion = '14.0.1000';
  readonly TICK_CHAR_LEFT = '[';
  readonly TICK_CHAR_RIGHT = ']';

  constructor(sequelize: Sequelize) {
    super(sequelize, DataTypes, 'mssql');
    this.connectionManager = new MsSqlConnectionManager(this, sequelize);
    this.queryGenerator = new MsSqlQueryGenerator({
      dialect: this,
      sequelize,
    });
    this.queryInterface = new MsSqlQueryInterface(
      sequelize,
      this.queryGenerator,
    );

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
    value = value.replaceAll('\'', '\'\'');

    return `N'${value}'`;
  }

  getDefaultSchema(): string {
    return 'dbo';
  }

  static getDefaultPort() {
    return 1433;
  }
}
