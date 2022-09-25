import type { Sequelize } from '../../sequelize.js';
import { createUnspecifiedOrderedBindCollector } from '../../utils/sql';
import type { SupportableNumericOptions } from '../abstract';
import { AbstractDialect } from '../abstract';
import { MySqlConnectionManager } from './connection-manager';
import * as DataTypes from './data-types';
import { registerMySqlDbDataTypeParsers } from './data-types.db.js';
import { escapeMysqlString } from './mysql-utils';
import { MySqlQuery } from './query';
import { MySqlQueryGenerator } from './query-generator';
import { MySqlQueryInterface } from './query-interface';

const integerOptions: SupportableNumericOptions = {
  zerofill: true,
  unsigned: true,
};

export class MysqlDialect extends AbstractDialect {
  static supports = AbstractDialect.extendSupport(
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
      dataTypes: {
        CHAR: {
          BINARY: true,
        },
        GEOMETRY: true,
        TINYINT: { ...integerOptions, signed: true },
        SMALLINT: integerOptions,
        MEDIUMINT: integerOptions,
        INTEGER: integerOptions,
        BIGINT: integerOptions,
        FLOAT: integerOptions,
        REAL: integerOptions,
        DOUBLE: integerOptions,
        DECIMAL: integerOptions,
      },
      jsonOperations: true,
      REGEXP: true,
      milliseconds: true,
    },
  );

  readonly connectionManager: MySqlConnectionManager;
  readonly queryGenerator: MySqlQueryGenerator;
  readonly queryInterface: MySqlQueryInterface;
  readonly Query = MySqlQuery;

  // minimum supported version
  readonly defaultVersion = '5.7.0';
  readonly TICK_CHAR = '`';
  readonly TICK_CHAR_LEFT = '`';
  readonly TICK_CHAR_RIGHT = '`';

  constructor(sequelize: Sequelize) {
    super(sequelize, DataTypes, 'mysql');
    this.connectionManager = new MySqlConnectionManager(this, sequelize);
    this.queryGenerator = new MySqlQueryGenerator({
      dialect: this,
      sequelize,
    });
    this.queryInterface = new MySqlQueryInterface(
      sequelize,
      this.queryGenerator,
    );

    registerMySqlDbDataTypeParsers(this);
  }

  createBindCollector() {
    return createUnspecifiedOrderedBindCollector();
  }

  escapeString(value: string): string {
    return escapeMysqlString(value);
  }

  canBackslashEscape() {
    return true;
  }

  static getDefaultPort() {
    return 3306;
  }
}

