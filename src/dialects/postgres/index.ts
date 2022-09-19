import cloneDeep from 'lodash/cloneDeep';
import merge from 'lodash/merge';
import type { Sequelize } from '../../sequelize.js';
import { createSpecifiedOrderedBindCollector } from '../../utils/sql';
import { AbstractDialect } from '../abstract';
import * as BaseTypes from '../abstract/data-types.js';
import { PostgresConnectionManager } from './connection-manager';
import * as DataTypes from './data-types';
import { PostgresQuery } from './query';
import { PostgresQueryGenerator } from './query-generator';
import { PostgresQueryInterface } from './query-interface';

export class PostgresDialect extends AbstractDialect {
  static readonly supports = merge(cloneDeep(AbstractDialect.supports), {
    'DEFAULT VALUES': true,
    EXCEPTION: true,
    'ON DUPLICATE KEY': false,
    'ORDER NULLS': true,
    returnValues: {
      returning: true,
    },
    bulkDefault: true,
    schemas: true,
    lock: true,
    lockOf: true,
    lockKey: true,
    lockOuterJoinFailure: true,
    skipLocked: true,
    forShare: 'FOR SHARE',
    index: {
      concurrently: true,
      using: 2,
      where: true,
      functionBased: true,
      operator: true,
    },
    inserts: {
      onConflictDoNothing: ' ON CONFLICT DO NOTHING',
      updateOnDuplicate: ' ON CONFLICT DO UPDATE SET',
      conflictFields: true,
    },
    dataTypes: {
      ARRAY: true,
      RANGE: true,
      GEOMETRY: true,
      REGEXP: true,
      IREGEXP: true,
      GEOGRAPHY: true,
      JSON: true,
      JSONB: true,
      HSTORE: true,
      TSVECTOR: true,
      DATETIME: {
        infinity: true,
      },
      DATEONLY: {
        infinity: true,
      },
    },
    deferrableConstraints: true,
    searchPath: true,
    escapeStringConstants: true,
    milliseconds: true,
  });

  readonly sequelize: Sequelize;
  readonly connectionManager: PostgresConnectionManager;
  readonly queryGenerator: PostgresQueryGenerator;
  readonly queryInterface: PostgresQueryInterface;
  readonly Query = PostgresQuery;
  readonly DataTypes = DataTypes;

  // minimum supported version
  readonly defaultVersion = '9.5.0';
  readonly name = 'postgres';
  readonly TICK_CHAR = '"';
  readonly TICK_CHAR_LEFT = '"';
  readonly TICK_CHAR_RIGHT = '"';

  constructor(sequelize: Sequelize) {
    super();
    this.sequelize = sequelize;
    this.connectionManager = new PostgresConnectionManager(this, sequelize);
    this.queryGenerator = new PostgresQueryGenerator({
      dialect: this,
      sequelize,
    });
    this.queryInterface = new PostgresQueryInterface(
      sequelize,
      this.queryGenerator,
    );

    // types & OIDs listed here https://github.com/lib/pq/blob/master/oid/types.go
    // range & enum are also supported, but use a special path as they are custom types
    this.registerDataTypeParser(BaseTypes.DATEONLY, ['date']);
    this.registerDataTypeParser(BaseTypes.DECIMAL, ['numeric']);
    this.registerDataTypeParser(BaseTypes.BOOLEAN, ['bool']);
    this.registerDataTypeParser(BaseTypes.GEOMETRY, ['geometry']);
    this.registerDataTypeParser(BaseTypes.GEOGRAPHY, ['geography']);
    this.registerDataTypeParser(BaseTypes.HSTORE, ['hstore']);
    this.registerDataTypeParser(new BaseTypes.RANGE(BaseTypes.INTEGER), ['int4range']);
    this.registerDataTypeParser(new BaseTypes.RANGE(BaseTypes.BIGINT), ['int8range']);
    this.registerDataTypeParser(new BaseTypes.RANGE(BaseTypes.DECIMAL), ['numrange']);
    // TODO: tsrange (without timezone) -- https://github.com/sequelize/sequelize/issues/14295
    this.registerDataTypeParser(new BaseTypes.RANGE(BaseTypes.DATE), ['tstzrange']);
    this.registerDataTypeParser(new BaseTypes.RANGE(BaseTypes.DATEONLY), ['daterange']);
  }

  createBindCollector() {
    return createSpecifiedOrderedBindCollector();
  }

  escapeBuffer(buffer: Buffer): string {
    const hex = buffer.toString('hex');

    // bytea hex format http://www.postgresql.org/docs/current/static/datatype-binary.html
    return `E'\\\\x${hex}'`;
  }

  escapeString(value: string): string {
    // http://www.postgresql.org/docs/8.2/static/sql-syntax-lexical.html#SQL-SYNTAX-STRINGS
    // http://stackoverflow.com/q/603572/130598
    value = value.replace(/'/g, '\'\'')
      // null character is not allowed in Postgres
      .replace(/\0/g, '\\0');

    return `'${value}'`;
  }

  canBackslashEscape() {
    // postgres can use \ to escape if one of these is true:
    // - standard_conforming_strings is off
    // - the string is prefixed with E (out of scope for this method)

    return !this.sequelize.options.standardConformingStrings;
  }

  static getDefaultPort() {
    return 5432;
  }
}
