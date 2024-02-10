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
    'ORDER NULLS': true,
    returnValues: 'returning',
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
    insert: {
      defaultValues: true,
      exception: true,
      onConflict: true,
      returning: true,
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
      MACADDR8: true,
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
    uuidV1Generation: true,
    uuidV4Generation: true,
    dropTable: {
      cascade: true,
    },
    truncate: {
      cascade: true,
      restartIdentity: true,
    },
    removeColumn: {
      cascade: true,
      ifExists: true,
    },
    renameTable: {
      changeSchemaAndTable: false,
    },
    createSchema: {
      authorization: true,
      ifNotExists: true,
    },
    dropSchema: {
      cascade: true,
      ifExists: true,
    },
    delete: {
      modelWithLimit: true,
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
    this.connectionManager = new PostgresConnectionManager(this);
    this.queryGenerator = new PostgresQueryGenerator(this);
    this.queryInterface = new PostgresQueryInterface(this);

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
