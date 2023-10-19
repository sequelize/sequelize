import type { Sequelize } from '../../sequelize.js';
import { createSpecifiedOrderedBindCollector } from '../../utils/sql';
import { AbstractDialect } from '../abstract';
import type { BindCollector } from '../abstract';
import { CockroachdbConnectionManager } from './connection-manager';
import * as DataTypes from './data-types';
import { registerCockroachDbDataTypeParsers } from './data-types-db';
import { CockroachDbQuery } from './query';
import { CockroachDbQueryGenerator } from './query-generator';
import { CockroachDbQueryInterface } from './query-interface';

export class CockroachDbDialect extends AbstractDialect {
  static readonly supports = AbstractDialect.extendSupport({
    'DEFAULT VALUES': true,
    'ON DUPLICATE KEY': false,
    'ORDER NULLS': true,
    returnValues: 'returning',
    bulkDefault: true,
    schemas: true,
    multiDatabases: true,
    lock: true,
    lockOf: true,
    forShare: 'FOR SHARE',
    index: {
      concurrently: true,
      using: 2,
      where: true,
      functionBased: true,
      operator: true,
      include: true,
      collate: false,
    },
    inserts: {
      onConflictDoNothing: ' ON CONFLICT DO NOTHING',
      updateOnDuplicate: ' ON CONFLICT DO UPDATE SET',
      conflictFields: true,
      onConflictWhere: true,
    },
    dataTypes: {
      ARRAY: true,
      GEOMETRY: true,
      GEOGRAPHY: true,
      JSON: true,
      JSONB: true,
      TSVECTOR: false,
      CITEXT: false,
      DATETIME: { infinity: false },
      DATEONLY: { infinity: false },
      FLOAT: { NaN: true, infinity: true },
      REAL: { NaN: true, infinity: true },
      DOUBLE: { NaN: true, infinity: true },
      DECIMAL: { unconstrained: true, NaN: true, infinity: true },
      CIDR: false,
      MACADDR: false,
      INET: true,
      RANGE: false,
    },
    jsonOperations: true,
    REGEXP: true,
    IREGEXP: true,
    searchPath: true,
    escapeStringConstants: true,
    globalTimeZoneConfig: true,
    dropTable: {
      cascade: true,
    },
    EXCEPTION: false,
    lockOuterJoinFailure: false,
    skipLocked: false,
    lockKey: false,
    constraints: {
      deferrable: false,
      removeOptions: { cascade: true, ifExists: true },
    },
    transactions: false,
    removeColumn: {
      ifExists: true,
      cascade: true,
      primaryKeyColumn: false,
    },
    renameTable: {
      changeSchemaAndTable: false,
    },
  });

  readonly connectionManager: CockroachdbConnectionManager;
  readonly queryGenerator: CockroachDbQueryGenerator;
  readonly queryInterface: CockroachDbQueryInterface;

  readonly Query = CockroachDbQuery;

  readonly defaultVersion = '4.0.0';
  readonly TICK_CHAR = '"';
  readonly TICK_CHAR_LEFT = '"';
  readonly TICK_CHAR_RIGHT = '"';
  readonly dataTypesDocumentationUrl = 'https://www.cockroachlabs.com/docs/stable/data-types.html';

  constructor(sequelize: Sequelize) {
    super(sequelize, DataTypes, 'cockroachdb');
    this.connectionManager = new CockroachdbConnectionManager(this, sequelize);
    this.queryGenerator = new CockroachDbQueryGenerator({ dialect: this, sequelize });
    this.queryInterface = new CockroachDbQueryInterface(sequelize, this.queryGenerator);

    registerCockroachDbDataTypeParsers(this);
  }

  createBindCollector(): BindCollector {
    return createSpecifiedOrderedBindCollector();
  }

  escapeBuffer(buffer: Buffer): string {
    const hex = buffer.toString('hex');

    // bytes hex format https://www.cockroachlabs.com/docs/stable/bytes
    return `'\\x${hex}'`;
  }

  escapeString(value: string): string {
    // https://www.cockroachlabs.com/docs/v23.1/sql-constants#standard-sql-string-literals
    value = value.replaceAll('\'', '\'\'')
      // null character is not allowed in Cockroachdb
      .replaceAll('\0', '\\0');

    return `'${value}'`;
  }

  getDefaultSchema(): string {
    return 'public';
  }

  static getDefaultPort(): number {
    return 26_257;
  }

  canBackslashEscape() {
    return !this.sequelize.options.standardConformingStrings;
  }
}
