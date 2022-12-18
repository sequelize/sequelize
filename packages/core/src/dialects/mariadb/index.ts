import type { FieldInfo } from 'mariadb';
import type { Sequelize } from '../../sequelize.js';
import { createUnspecifiedOrderedBindCollector } from '../../utils/sql';
import type { SupportableNumericOptions } from '../abstract';
import { AbstractDialect } from '../abstract';
import { registerMySqlDbDataTypeParsers } from '../mysql/data-types.db.js';
import { escapeMysqlString } from '../mysql/mysql-utils';
import { MySqlQueryInterface } from '../mysql/query-interface';
import { MariaDbConnectionManager } from './connection-manager';
import * as DataTypes from './data-types';
import { MariaDbQuery } from './query';
import { MariaDbQueryGenerator } from './query-generator';

const numericOptions: SupportableNumericOptions = {
  zerofill: true,
  unsigned: true,
};

export class MariaDbDialect extends AbstractDialect {
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
        foreignKeyChecksDisableable: true,
      },
      indexViaAlter: true,
      indexHints: true,
      dataTypes: {
        COLLATE_BINARY: true,
        GEOMETRY: true,
        INTS: numericOptions,
        FLOAT: { ...numericOptions, scaleAndPrecision: true },
        REAL: { ...numericOptions, scaleAndPrecision: true },
        DOUBLE: { ...numericOptions, scaleAndPrecision: true },
        DECIMAL: numericOptions,
        JSON: true,
      },
      REGEXP: true,
      jsonOperations: true,
      globalTimeZoneConfig: true,
    },
  );

  readonly TICK_CHAR = '`';
  readonly TICK_CHAR_LEFT = '`';
  readonly TICK_CHAR_RIGHT = '`';
  readonly defaultVersion = '10.1.44'; // minimum supported version
  readonly dataTypesDocumentationUrl = 'https://mariadb.com/kb/en/library/resultset/#field-types';

  readonly queryGenerator: MariaDbQueryGenerator;
  readonly connectionManager: MariaDbConnectionManager;
  readonly queryInterface: MySqlQueryInterface;

  readonly Query = MariaDbQuery;

  constructor(sequelize: Sequelize) {
    super(sequelize, DataTypes, 'mariadb');
    this.connectionManager = new MariaDbConnectionManager(this, sequelize);
    this.queryGenerator = new MariaDbQueryGenerator({
      dialect: this,
      sequelize,
    });
    this.queryInterface = new MySqlQueryInterface(
      sequelize,
      this.queryGenerator,
    );

    registerMySqlDbDataTypeParsers(this);
    // DECIMAL must be returned as a string, the JS number type is not precise enough.
    this.registerDataTypeParser(['NEWDECIMAL'], (value: FieldInfo) => {
      return value.string();
    });
  }

  createBindCollector() {
    return createUnspecifiedOrderedBindCollector();
  }

  escapeString(value: string) {
    return escapeMysqlString(value);
  }

  canBackslashEscape() {
    return true;
  }

  getDefaultSchema(): string {
    return this.sequelize.options.database ?? '';
  }

  static getDefaultPort() {
    return 3306;
  }
}
