import type { Dialect } from '../../sequelize.js';
import type { AbstractQueryGenerator } from './query-generator.js';
import type { AbstractQuery } from './query.js';

export type DialectSupports = {
  'DEFAULT': boolean,
  'DEFAULT VALUES': boolean,
  'VALUES ()': boolean,
  'LIMIT ON UPDATE': boolean,
  'ON DUPLICATE KEY': boolean,
  'ORDER NULLS': boolean,
  'UNION': boolean,
  'UNION ALL': boolean,
  'RIGHT JOIN': boolean,
  EXCEPTION: boolean,

  forShare?: 'LOCK IN SHARE MODE' | 'FOR SHARE' | undefined,
  lock: boolean,
  lockOf: boolean,
  lockKey: boolean,
  lockOuterJoinFailure: boolean,
  skipLocked: boolean,
  finalTable: boolean,

  /* does the dialect support returning values for inserted/updated fields */
  returnValues: false | {
    output: boolean,
    returning: boolean,
  },

  /* features specific to autoIncrement values */
  autoIncrement: {
    /* does the dialect require modification of insert queries when inserting auto increment fields */
    identityInsert: boolean,

    /* does the dialect support inserting default/null values for autoincrement fields */
    defaultValue: boolean,

    /* does the dialect support updating autoincrement fields */
    update: boolean,
  },
  /* Do we need to say DEFAULT for bulk insert */
  bulkDefault: boolean,
  schemas: boolean,
  transactions: boolean,
  settingIsolationLevelDuringTransaction: boolean,
  transactionOptions: {
    type: boolean,
  },
  migrations: boolean,
  upserts: boolean,
  inserts: {
    ignoreDuplicates: string, /* dialect specific words for INSERT IGNORE or DO NOTHING */
    updateOnDuplicate: boolean | string, /* whether dialect supports ON DUPLICATE KEY UPDATE */
    onConflictDoNothing: string, /* dialect specific words for ON CONFLICT DO NOTHING */
    conflictFields: boolean, /* whether the dialect supports specifying conflict fields or not */
  },
  constraints: {
    restrict: boolean,
    addConstraint: boolean,
    dropConstraint: boolean,
    unique: boolean,
    default: boolean,
    check: boolean,
    foreignKey: boolean,
    primaryKey: boolean,
    onUpdate: boolean,
  },
  index: {
    collate: boolean,
    length: boolean,
    parser: boolean,
    concurrently: boolean,
    type: boolean,
    using: boolean | number,
    functionBased: boolean,
    operator: boolean,
    where: boolean,
  },
  groupedLimit: boolean,
  indexViaAlter: boolean,
  JSON: boolean,
  JSONB: boolean,
  ARRAY: boolean,
  RANGE: boolean,
  NUMERIC: boolean,
  GEOMETRY: boolean,
  GEOGRAPHY: boolean,
  REGEXP: boolean,
  /**
   * Case-insensitive regexp operator support ('~*' in postgres).
   */
  IREGEXP: boolean,
  HSTORE: boolean,
  TSVECTOR: boolean,
  deferrableConstraints: boolean,
  tmpTableTrigger: boolean,
  indexHints: boolean,
  searchPath: boolean,
};

export abstract class AbstractDialect {
  /**
   * List of features this dialect supports.
   *
   * Important: Dialect implementations inherit these values.
   * When changing a default, ensure the implementations still properly declare which feature they support.
   */
  static readonly supports: DialectSupports = {
    DEFAULT: true,
    'DEFAULT VALUES': false,
    'VALUES ()': false,
    'LIMIT ON UPDATE': false,
    'ON DUPLICATE KEY': true,
    'ORDER NULLS': false,
    UNION: true,
    'UNION ALL': true,
    'RIGHT JOIN': true,
    EXCEPTION: false,
    lock: false,
    lockOf: false,
    lockKey: false,
    lockOuterJoinFailure: false,
    skipLocked: false,
    finalTable: false,
    returnValues: false,
    autoIncrement: {
      identityInsert: false,
      defaultValue: true,
      update: true,
    },
    bulkDefault: false,
    schemas: false,
    transactions: true,
    settingIsolationLevelDuringTransaction: true,
    transactionOptions: {
      type: false,
    },
    migrations: true,
    upserts: true,
    inserts: {
      ignoreDuplicates: '',
      updateOnDuplicate: false,
      onConflictDoNothing: '',
      conflictFields: false,
    },
    constraints: {
      restrict: true,
      addConstraint: true,
      dropConstraint: true,
      unique: true,
      default: false,
      check: true,
      foreignKey: true,
      primaryKey: true,
      onUpdate: true,
    },
    index: {
      collate: true,
      length: false,
      parser: false,
      concurrently: false,
      type: false,
      using: true,
      functionBased: false,
      operator: false,
      where: false,
    },
    groupedLimit: true,
    indexViaAlter: false,
    JSON: false,
    JSONB: false,
    NUMERIC: false,
    ARRAY: false,
    RANGE: false,
    GEOMETRY: false,
    REGEXP: false,
    IREGEXP: false,
    GEOGRAPHY: false,
    HSTORE: false,
    TSVECTOR: false,
    deferrableConstraints: false,
    tmpTableTrigger: false,
    indexHints: false,
    searchPath: false,
  };

  declare readonly defaultVersion: string;
  declare readonly Query: typeof AbstractQuery;
  declare readonly name: Dialect;
  declare readonly TICK_CHAR: string;
  declare readonly TICK_CHAR_LEFT: string;
  declare readonly TICK_CHAR_RIGHT: string;
  declare readonly queryGenerator: AbstractQueryGenerator;

  get supports(): DialectSupports {
    const Dialect = this.constructor as typeof AbstractDialect;

    return Dialect.supports;
  }

  abstract createBindCollector(): BindCollector;
}

export type BindCollector = {
  /**
   *
   *
   * @param {string} bindParameterName The name of the bind parameter
   * @returns {string}
   */
  collect(bindParameterName: string): string,

  /**
   * Returns either an array of orders if the bind parameters are mapped to numeric parameters (e.g. '?', $1, @1),
   * or null if no mapping was necessary because the dialect supports named parameters.
   */
  getBindParameterOrder(): string[] | null,
};
