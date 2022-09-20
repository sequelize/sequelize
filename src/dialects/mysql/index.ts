import type { Sequelize } from '../../sequelize.js';
import { createUnspecifiedOrderedBindCollector } from '../../utils/sql';
import type { SupportableIntegerOptions } from '../abstract';
import { AbstractDialect } from '../abstract';
import * as BaseTypes from '../abstract/data-types.js';
import { MySqlConnectionManager } from './connection-manager';
import * as DataTypes from './data-types';
import { escapeMysqlString } from './mysql-utils';
import { MySqlQuery } from './query';
import { MySqlQueryGenerator } from './query-generator';
import { MySqlQueryInterface } from './query-interface';

const integerOptions: SupportableIntegerOptions = {
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
        JSON: true,
        REGEXP: true,
        TINYINT: integerOptions,
        SMALLINT: integerOptions,
        MEDIUMINT: integerOptions,
        INTEGER: integerOptions,
        BIGINT: integerOptions,
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

    /*
     * @see buffer_type here https://dev.mysql.com/doc/refman/5.7/en/c-api-prepared-statement-type-codes.html
     * @see hex here https://github.com/sidorares/node-mysql2/blob/master/lib/constants/types.js
     */
    this.registerDataTypeParser(BaseTypes.DATE, ['DATETIME']);
    this.registerDataTypeParser(BaseTypes.STRING, ['VAR_STRING']);
    this.registerDataTypeParser(BaseTypes.CHAR, ['STRING']);
    this.registerDataTypeParser(BaseTypes.TEXT, ['BLOB']);
    this.registerDataTypeParser(BaseTypes.TINYINT, ['TINY']);
    this.registerDataTypeParser(BaseTypes.SMALLINT, ['SHORT']);
    this.registerDataTypeParser(BaseTypes.MEDIUMINT, ['INT24']);
    this.registerDataTypeParser(BaseTypes.INTEGER, ['LONG']);
    this.registerDataTypeParser(BaseTypes.BIGINT, ['LONGLONG']);
    this.registerDataTypeParser(BaseTypes.FLOAT, ['FLOAT']);
    this.registerDataTypeParser(BaseTypes.TIME, ['TIME']);
    this.registerDataTypeParser(BaseTypes.DATEONLY, ['DATE']);
    this.registerDataTypeParser(BaseTypes.BOOLEAN, ['TINY']);
    this.registerDataTypeParser(BaseTypes.BLOB, ['TINYBLOB', 'BLOB', 'LONGBLOB']);
    this.registerDataTypeParser(BaseTypes.DECIMAL, ['NEWDECIMAL']);
    this.registerDataTypeParser(BaseTypes.DOUBLE, ['DOUBLE']);
    this.registerDataTypeParser(BaseTypes.GEOMETRY, ['GEOMETRY']);
    this.registerDataTypeParser(BaseTypes.JSON, ['JSON']);
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

