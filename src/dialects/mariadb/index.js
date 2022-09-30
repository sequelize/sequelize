'use strict';

import { createUnspecifiedOrderedBindCollector } from '../../utils/sql';
import { AbstractDialect } from '../abstract';

const _ = require('lodash');
const { MariaDbConnectionManager } = require('./connection-manager');
const { MariaDbQuery } = require('./query');
const { MariaDbQueryGenerator } = require('./query-generator');
const { MySqlQueryInterface } = require('../mysql/query-interface');
const DataTypes = require('../../data-types').mariadb;

export class MariaDbDialect extends AbstractDialect {
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
    this.connectionManager = new MariaDbConnectionManager(this, sequelize);
    this.queryGenerator = new MariaDbQueryGenerator({
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

MariaDbDialect.prototype.defaultVersion = '10.1.44'; // minimum supported version
MariaDbDialect.prototype.Query = MariaDbQuery;
MariaDbDialect.prototype.QueryGenerator = MariaDbQueryGenerator;
MariaDbDialect.prototype.DataTypes = DataTypes;
MariaDbDialect.prototype.name = 'mariadb';
MariaDbDialect.prototype.TICK_CHAR = '`';
MariaDbDialect.prototype.TICK_CHAR_LEFT = MariaDbDialect.prototype.TICK_CHAR;
MariaDbDialect.prototype.TICK_CHAR_RIGHT = MariaDbDialect.prototype.TICK_CHAR;
