import cloneDeep from 'lodash/cloneDeep';
import merge from 'lodash/merge';
import type { Sequelize } from '../../sequelize.js';
import { createSpecifiedOrderedBindCollector } from '../../utils/sql';
import { AbstractDialect } from '../abstract';
import type { AbstractQueryGenerator } from '../abstract/query-generator.js';
import type { QueryInterface } from '../abstract/query-interface.js';
// eslint-disable-next-line import/order
import * as DataTypes from './data-types';

const { PostgresConnectionManager } = require('./connection-manager');
const { PostgresQuery } = require('./query');
const { PostgresQueryGenerator } = require('./query-generator');
const { PostgresQueryInterface } = require('./query-interface');

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
    },
    deferrableConstraints: true,
    searchPath: true,
  });

  readonly sequelize: Sequelize;

  // TODO: type these once they have been migrated to TypeScript
  readonly connectionManager: unknown;
  readonly queryGenerator: AbstractQueryGenerator;
  readonly queryInterface: QueryInterface;

  // minimum supported version
  readonly DataTypes = DataTypes;
  readonly defaultVersion = '9.5.0';
  readonly Query = PostgresQuery;
  readonly name = 'postgres';
  readonly TICK_CHAR = '"';
  readonly TICK_CHAR_LEFT = '"';
  readonly TICK_CHAR_RIGHT = '"';

  constructor(sequelize: Sequelize) {
    super();
    this.sequelize = sequelize;
    this.connectionManager = new PostgresConnectionManager(this, sequelize);
    this.queryGenerator = new PostgresQueryGenerator({
      _dialect: this,
      sequelize,
    });
    this.queryInterface = new PostgresQueryInterface(
      sequelize,
      this.queryGenerator,
    );
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
}
