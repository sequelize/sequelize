'use strict';

import { createUnspecifiedOrderedBindCollector } from '../../utils/sql';
import { AbstractDialect } from '../abstract';

const _ = require('lodash');
const { MySqlConnectionManager } = require('./connection-manager');
const { MySqlQuery } = require('./query');
const { MySqlQueryGenerator } = require('./query-generator');
const DataTypes = require('../../data-types').mysql;
const { MySqlQueryInterface } = require('./query-interface');

export class MysqlDialect extends AbstractDialect {
  static supports = _.merge(
    _.cloneDeep(AbstractDialect.supports),
    {
      'VALUES ()': true,
      'LIMIT ON UPDATE': true,
      lock: true,
      forShare: 'LOCK IN SHARE MODE',
      settingIsolationLevelDuringTransaction: false,
      schemas: true,
      inserts: {
        ignoreDuplicates: ' IGNORE',
        updateOnDuplicate: ' ON DUPLICATE KEY UPDATE',
      },
      index: {
        collate: false,
        length: true,
        parser: true,
        type: true,
        using: 1,
      },
      constraints: {
        dropConstraint: false,
        check: false,
      },
      indexViaAlter: true,
      indexHints: true,
      NUMERIC: true,
      GEOMETRY: true,
      JSON: true,
      REGEXP: true,
    },
  );

  constructor(sequelize) {
    super();
    this.sequelize = sequelize;
    this.connectionManager = new MySqlConnectionManager(this, sequelize);
    this.queryGenerator = new MySqlQueryGenerator({
      dialect: this,
      sequelize,
    });
    this.queryInterface = new MySqlQueryInterface(
      sequelize,
      this.queryGenerator,
    );
  }

  createBindCollector() {
    return createUnspecifiedOrderedBindCollector();
  }

  canBackslashEscape() {
    return true;
  }

  static getDefaultPort() {
    return 3306;
  }
}

MysqlDialect.prototype.defaultVersion = '5.7.0'; // minimum supported version
MysqlDialect.prototype.Query = MySqlQuery;
MysqlDialect.prototype.QueryGenerator = MySqlQueryGenerator;
MysqlDialect.prototype.DataTypes = DataTypes;
MysqlDialect.prototype.name = 'mysql';
MysqlDialect.prototype.TICK_CHAR = '`';
MysqlDialect.prototype.TICK_CHAR_LEFT = MysqlDialect.prototype.TICK_CHAR;
MysqlDialect.prototype.TICK_CHAR_RIGHT = MysqlDialect.prototype.TICK_CHAR;
