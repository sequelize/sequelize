import cloneDeep from 'lodash/cloneDeep';
import merge from 'lodash/merge';
import type { Sequelize } from '../../sequelize.js';
import { createUnspecifiedOrderedBindCollector } from '../../utils/sql';
import { AbstractDialect } from '../abstract';
import { MySqlConnectionManager } from './connection-manager';
import * as DataTypes from './data-types';
import { escapeMysqlString } from './mysql-utils';
import { MySqlQuery } from './query';
import { MySqlQueryGenerator } from './query-generator';
import { MySqlQueryInterface } from './query-interface';

export class MysqlDialect extends AbstractDialect {
  static supports = merge(
    cloneDeep(AbstractDialect.supports),
    {
      'VALUES ()': true,
      'LIMIT ON UPDATE': true,
      lock: true,
      forShare: 'LOCK IN SHARE MODE',
      settingIsolationLevelDuringTransaction: false,
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
      GEOMETRY: true,
      JSON: true,
      REGEXP: true,
      dataTypes: {
        CHAR: {
          BINARY: true,
        },
      },
      milliseconds: true,
    },
  );

  readonly sequelize: Sequelize;
  readonly connectionManager: MySqlConnectionManager;
  readonly queryGenerator: MySqlQueryGenerator;
  readonly queryInterface: MySqlQueryInterface;
  readonly Query = MySqlQuery;
  readonly DataTypes = DataTypes;

  // minimum supported version
  readonly defaultVersion = '5.7.0';
  readonly name = 'mysql';
  readonly TICK_CHAR = '`';
  readonly TICK_CHAR_LEFT = '`';
  readonly TICK_CHAR_RIGHT = '`';

  constructor(sequelize: Sequelize) {
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

