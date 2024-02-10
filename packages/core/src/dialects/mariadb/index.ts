import type { Sequelize } from '../../sequelize.js';
import { createUnspecifiedOrderedBindCollector, escapeMysqlMariaDbString } from '../../utils/sql';
import type { SupportableNumericOptions } from '../abstract';
import { AbstractDialect } from '../abstract';
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
      'LIMIT ON UPDATE': true,
      lock: true,
      forShare: 'LOCK IN SHARE MODE',
      settingIsolationLevelDuringTransaction: false,
      schemas: true,
      // TODO [>=2024-06-19]: uncomment when MariaDB 10.5 is oldest supported version
      // returnValues: 'returning',
      insert: {
        ignore: true,
        // TODO [>=2024-06-19]: uncomment when MariaDB 10.5 is oldest supported version
        // returning: true,
        updateOnDuplicate: true,
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
      uuidV1Generation: true,
      globalTimeZoneConfig: true,
      removeColumn: {
        ifExists: true,
      },
      createSchema: {
        charset: true,
        collate: true,
        // TODO [>=2024-06-19]: uncomment when MariaDB 10.5 is oldest supported version
        // comment: true,
        ifNotExists: true,
        replace: true,
      },
      dropSchema: {
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
    this.connectionManager = new MariaDbConnectionManager(this);
    this.queryGenerator = new MariaDbQueryGenerator(this);
    this.queryInterface = new MariaDbQueryInterface(this);

    registerMariaDbDbDataTypeParsers(this);
  }

  createBindCollector() {
    return createUnspecifiedOrderedBindCollector();
  }

  escapeString(value: string) {
    return escapeMysqlMariaDbString(value);
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
