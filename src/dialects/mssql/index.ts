import type { Sequelize } from '../../sequelize.js';
import { createNamedParamBindCollector } from '../../utils/sql';
import { AbstractDialect } from '../abstract';
import { MsSqlConnectionManager } from './connection-manager';
import * as DataTypes from './data-types';
import { MsSqlQueryGenerator } from './query-generator';
import { MsSqlQueryInterface } from './query-interface';
import { MsSqlQuery } from './query.js';

export class MssqlDialect extends AbstractDialect {
  static supports = AbstractDialect.extendSupport({
    'DEFAULT VALUES': true,
    'LIMIT ON UPDATE': true,
    migrations: false,
    returnValues: {
      output: true,
    },
    schemas: true,
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
    },
    index: {
      collate: false,
      type: true,
      using: false,
      where: true,
    },
    tmpTableTrigger: true,
    dataTypes: {
      CHAR: {
        BINARY: true,
      },
    },
    milliseconds: true,
  });

  readonly connectionManager: MsSqlConnectionManager;
  readonly queryGenerator: MsSqlQueryGenerator;
  readonly queryInterface: MsSqlQueryInterface;
  readonly Query = MsSqlQuery;
  readonly DataTypes = DataTypes;

  // SQL Server 2017 Express (version 14), minimum supported version, all the way
  // up to the most recent version. When increasing this version, remember to
  // update also the minimum version in the documentation at
  //   https://github.com/sequelize/website/blob/main/docs/other-topics/dialect-specific-things.md
  // and set the relevant years for the mssql Docker images in the ci.yml file at
  //   .github/workflows/ci.yml
  // minimum supported version
  readonly defaultVersion = '14.0.1000';
  readonly name = 'mssql';
  readonly TICK_CHAR = '"';
  readonly TICK_CHAR_LEFT = '[';
  readonly TICK_CHAR_RIGHT = ']';

  constructor(sequelize: Sequelize) {
    super(sequelize);
    this.connectionManager = new MsSqlConnectionManager(this, sequelize);
    this.queryGenerator = new MsSqlQueryGenerator({
      dialect: this,
      sequelize,
    });
    this.queryInterface = new MsSqlQueryInterface(
      sequelize,
      this.queryGenerator,
    );
  }

  createBindCollector() {
    return createNamedParamBindCollector('@');
  }

  escapeString(value: string): string {
    // http://www.postgresql.org/docs/8.2/static/sql-syntax-lexical.html#SQL-SYNTAX-STRINGS
    // http://stackoverflow.com/q/603572/130598
    value = value.replace(/'/g, '\'\'');

    return `N'${value}'`;
  }

  static getDefaultPort() {
    return 1433;
  }
}
