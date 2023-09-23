import type { Sequelize } from '../../sequelize.js';
import { createUnspecifiedOrderedBindCollector } from '../../utils/sql';
import type { SupportableNumericOptions } from '../abstract';
import { AbstractDialect } from '../abstract';
import { escapeMysqlString } from '../mysql/mysql-utils';
import { MariaDbConnectionManager } from './connection-manager';
import * as DataTypes from './data-types';
import { registerMariaDbDbDataTypeParsers } from './data-types.db.js';
import { MariaDbQuery } from './query';
import { MariaDbQueryGenerator } from './query-generator';
import { MariaDbQueryInterface } from './query-interface';

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
        foreignKeyChecksDisableable: true,
        removeOptions: { ifExists: true },
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
      jsonExtraction: {
        unquoted: true,
        quoted: true,
      },
      globalTimeZoneConfig: true,
      removeColumn: {
        ifExists: true,
      },
    },
  );

  readonly TICK_CHAR_LEFT = '`';
  readonly TICK_CHAR_RIGHT = '`';
  readonly defaultVersion = '10.4.30'; // minimum supported version
  readonly dataTypesDocumentationUrl = 'https://mariadb.com/kb/en/library/resultset/#field-types';

  readonly queryGenerator: MariaDbQueryGenerator;
  readonly connectionManager: MariaDbConnectionManager;
  readonly queryInterface: MariaDbQueryInterface;

  readonly Query = MariaDbQuery;

  constructor(sequelize: Sequelize) {
    super(sequelize, DataTypes, 'mariadb');
    this.connectionManager = new MariaDbConnectionManager(this, sequelize);
    this.queryGenerator = new MariaDbQueryGenerator({
      dialect: this,
      sequelize,
    });
    this.queryInterface = new MariaDbQueryInterface(
      sequelize,
      this.queryGenerator,
    );

    registerMariaDbDbDataTypeParsers(this);
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
