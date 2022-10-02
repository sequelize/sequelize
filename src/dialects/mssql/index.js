'use strict';

import { createNamedParamBindCollector, createSpecifiedOrderedBindCollector } from '../../utils/sql';

const _ = require('lodash');
const { AbstractDialect } = require('../abstract');
const { MsSqlConnectionManager } = require('./connection-manager');
const { MsSqlQuery } = require('./query');
const { MsSqlQueryGenerator } = require('./query-generator');
const DataTypes = require('../../data-types').mssql;
const { MsSqlQueryInterface } = require('./query-interface');

export class MssqlDialect extends AbstractDialect {
  static supports = _.merge(_.cloneDeep(AbstractDialect.supports), {
    'DEFAULT VALUES': true,
    'LIMIT ON UPDATE': true,
    migrations: false,
    returnValues: {
      output: true,
    },
    schemas: true,
    databases: true,
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
    NUMERIC: true,
    tmpTableTrigger: true,
  });

  constructor(sequelize) {
    super();
    this.sequelize = sequelize;
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

  static getDefaultPort() {
    return 1433;
  }
}

// SQL Server 2017 Express (version 14), minimum supported version, all the way
// up to the most recent version. When increasing this version, remember to
// update also the minimum version in the documentation at
//   https://github.com/sequelize/website/blob/main/docs/other-topics/dialect-specific-things.md
// and set the relevant years for the mssql Docker images in the ci.yml file at
//   .github/workflows/ci.yml
MssqlDialect.prototype.defaultVersion = '14.0.1000';
MssqlDialect.prototype.Query = MsSqlQuery;
MssqlDialect.prototype.name = 'mssql';
MssqlDialect.prototype.TICK_CHAR = '"';
MssqlDialect.prototype.TICK_CHAR_LEFT = '[';
MssqlDialect.prototype.TICK_CHAR_RIGHT = ']';
MssqlDialect.prototype.DataTypes = DataTypes;
