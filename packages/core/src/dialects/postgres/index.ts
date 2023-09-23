import type { Sequelize } from '../../sequelize.js';
import { createSpecifiedOrderedBindCollector } from '../../utils/sql';
import { AbstractDialect } from '../abstract';
import { PostgresConnectionManager } from './connection-manager';
import { registerPostgresDbDataTypeParsers } from './data-types-db.js';
import * as DataTypes from './data-types.js';
import { PostgresQuery } from './query';
import { PostgresQueryGenerator } from './query-generator';
import { PostgresQueryInterface } from './query-interface';

export class PostgresDialect extends AbstractDialect {
  static readonly supports = AbstractDialect.extendSupport({
    'DEFAULT VALUES': true,
    EXCEPTION: true,
    'ON DUPLICATE KEY': false,
    'ORDER NULLS': true,
    returnValues: 'returning',
    bulkDefault: true,
    schemas: true,
    multiDatabases: true,
    lock: true,
    lockOf: true,
    lockKey: true,
    lockOuterJoinFailure: true,
    skipLocked: true,
    forShare: 'FOR SHARE',
    constraints: {
      deferrable: true,
      removeOptions: { cascade: true, ifExists: true },
    },
    index: {
      concurrently: true,
      using: 2,
      where: true,
      functionBased: true,
      operator: true,
      include: true,
    },
    inserts: {
      onConflictDoNothing: ' ON CONFLICT DO NOTHING',
      updateOnDuplicate: ' ON CONFLICT DO UPDATE SET',
      conflictFields: true,
      onConflictWhere: true,
    },
    dataTypes: {
      ARRAY: true,
      RANGE: true,
      GEOMETRY: true,
      GEOGRAPHY: true,
      JSON: true,
      JSONB: true,
      HSTORE: true,
      TSVECTOR: true,
      CITEXT: true,
      DATETIME: { infinity: true },
      DATEONLY: { infinity: true },
      FLOAT: { NaN: true, infinity: true },
      REAL: { NaN: true, infinity: true },
      DOUBLE: { NaN: true, infinity: true },
      DECIMAL: { unconstrained: true, NaN: true, infinity: true },
      CIDR: true,
      MACADDR: true,
      INET: true,
    },
    jsonOperations: true,
    jsonExtraction: {
      unquoted: true,
      quoted: true,
    },
    REGEXP: true,
    IREGEXP: true,
    searchPath: true,
    escapeStringConstants: true,
    globalTimeZoneConfig: true,
    dropTable: {
      cascade: true,
    },
    truncate: {
      cascade: true,
    },
    removeColumn: {
      cascade: true,
      ifExists: true,
    },
  });

  readonly connectionManager: PostgresConnectionManager;
  readonly queryGenerator: PostgresQueryGenerator;
  readonly queryInterface: PostgresQueryInterface;
  readonly Query = PostgresQuery;
  readonly dataTypesDocumentationUrl = 'https://www.postgresql.org/docs/current/datatype.html';

  // minimum supported version
  readonly defaultVersion = '11.0.0';
  readonly TICK_CHAR_LEFT = '"';
  readonly TICK_CHAR_RIGHT = '"';

  constructor(sequelize: Sequelize) {
    super(sequelize, DataTypes, 'postgres');
    this.connectionManager = new PostgresConnectionManager(this, sequelize);
    this.queryGenerator = new PostgresQueryGenerator({
      dialect: this,
      sequelize,
    });
    this.queryInterface = new PostgresQueryInterface(
      sequelize,
      this.queryGenerator,
    );

    registerPostgresDbDataTypeParsers(this);
  }

  createBindCollector() {
    return createSpecifiedOrderedBindCollector();
  }

  escapeBuffer(buffer: Buffer): string {
    const hex = buffer.toString('hex');

    // bytea hex format http://www.postgresql.org/docs/current/static/datatype-binary.html
    return `'\\x${hex}'`;
  }

  escapeString(value: string): string {
    // http://www.postgresql.org/docs/8.2/static/sql-syntax-lexical.html#SQL-SYNTAX-STRINGS
    // http://stackoverflow.com/q/603572/130598
    value = value.replaceAll('\'', '\'\'')
      // null character is not allowed in Postgres
      .replaceAll('\0', '\\0');

    return `'${value}'`;
  }

  canBackslashEscape() {
    // postgres can use \ to escape if one of these is true:
    // - standard_conforming_strings is off
    // - the string is prefixed with E (out of scope for this method)

    return !this.sequelize.options.standardConformingStrings;
  }

  getDefaultSchema() {
    return 'public';
  }

  static getDefaultPort() {
    return 5432;
  }
}
