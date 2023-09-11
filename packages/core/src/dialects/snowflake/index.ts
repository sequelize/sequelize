import type { Sequelize } from '../../sequelize.js';
import { createUnspecifiedOrderedBindCollector } from '../../utils/sql';
import { AbstractDialect } from '../abstract';
import { SnowflakeConnectionManager } from './connection-manager';
import * as DataTypes from './data-types.js';
import { SnowflakeQuery } from './query';
import { SnowflakeQueryGenerator } from './query-generator';
import { SnowflakeQueryInterface } from './query-interface';

export class SnowflakeDialect extends AbstractDialect {
  static supports = AbstractDialect.extendSupport({
    'VALUES ()': true,
    'LIMIT ON UPDATE': true,
    lock: true,
    forShare: 'LOCK IN SHARE MODE',
    settingIsolationLevelDuringTransaction: false,
    inserts: {
      ignoreDuplicates: ' IGNORE',
      // disable for now, but could be enable by approach below
      // https://stackoverflow.com/questions/54828745/how-to-migrate-on-conflict-do-nothing-from-postgresql-to-snowflake
      // updateOnDuplicate: true
    },
    index: {
      collate: false,
      length: true,
      parser: true,
      type: true,
      using: 1,
    },
    constraints: {
      deferrable: true,
      check: false,
      removeOptions: { cascade: true },
    },
    indexViaAlter: true,
    indexHints: true,
    schemas: true,
    multiDatabases: true,
    dataTypes: {
      COLLATE_BINARY: true,
    },
    REGEXP: true,
    globalTimeZoneConfig: true,
    dropTable: {
      cascade: true,
    },
  });

  readonly dataTypesDocumentationUrl = 'https://docs.snowflake.com/en/sql-reference/data-types.html';
  // TODO: fix the minimum supported version
  readonly defaultVersion = '5.7.0';
  readonly Query = SnowflakeQuery;
  readonly TICK_CHAR_LEFT = '"';
  readonly TICK_CHAR_RIGHT = '"';
  readonly connectionManager: SnowflakeConnectionManager;
  readonly queryGenerator: SnowflakeQueryGenerator;
  readonly queryInterface: SnowflakeQueryInterface;

  constructor(sequelize: Sequelize) {
    console.warn('The Snowflake dialect is experimental and usage is at your own risk. Its development is exclusively community-driven and not officially supported by the maintainers.');

    super(sequelize, DataTypes, 'snowflake');
    this.connectionManager = new SnowflakeConnectionManager(this, sequelize);
    this.queryGenerator = new SnowflakeQueryGenerator({
      dialect: this,
      sequelize,
    });
    this.queryInterface = new SnowflakeQueryInterface(sequelize, this.queryGenerator);
  }

  createBindCollector() {
    return createUnspecifiedOrderedBindCollector();
  }

  getDefaultSchema(): string {
    return 'PUBLIC';
  }

  static getDefaultPort() {
    return 3306;
  }
}
