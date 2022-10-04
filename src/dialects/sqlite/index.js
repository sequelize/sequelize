'use strict';

import { createNamedParamBindCollector } from '../../utils/sql';

const _ = require('lodash');
const { AbstractDialect } = require('../abstract');
const { SqliteConnectionManager } = require('./connection-manager');
const { SqliteQuery } = require('./query');
const { SqliteQueryGenerator } = require('./query-generator');
const DataTypes = require('../../data-types').sqlite;
const { SqliteQueryInterface } = require('./query-interface');

export class SqliteDialect extends AbstractDialect {
  static supports = _.merge(_.cloneDeep(AbstractDialect.supports), {
    DEFAULT: false,
    'DEFAULT VALUES': true,
    'UNION ALL': false,
    'RIGHT JOIN': false,
    inserts: {
      ignoreDuplicates: ' OR IGNORE',
      updateOnDuplicate: ' ON CONFLICT DO UPDATE SET',
      conflictFields: true,
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
      addConstraint: false,
      dropConstraint: false,
    },
    groupedLimit: false,
    JSON: true,
  });

  constructor(sequelize) {
    super();
    this.sequelize = sequelize;
    this.connectionManager = new SqliteConnectionManager(this, sequelize);
    this.queryGenerator = new SqliteQueryGenerator({
      dialect: this,
      sequelize,
    });

    this.queryInterface = new SqliteQueryInterface(
      sequelize,
      this.queryGenerator,
    );
  }

  createBindCollector() {
    return createNamedParamBindCollector('$');
  }

  static getDefaultPort() {
    return 0;
  }
}

SqliteDialect.prototype.defaultVersion = '3.8.0'; // minimum supported version
SqliteDialect.prototype.Query = SqliteQuery;
SqliteDialect.prototype.DataTypes = DataTypes;
SqliteDialect.prototype.name = 'sqlite';
SqliteDialect.prototype.TICK_CHAR = '`';
SqliteDialect.prototype.TICK_CHAR_LEFT = SqliteDialect.prototype.TICK_CHAR;
SqliteDialect.prototype.TICK_CHAR_RIGHT = SqliteDialect.prototype.TICK_CHAR;
