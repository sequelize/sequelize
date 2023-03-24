import type { Dialect } from '../../sequelize.js';
import type { AbstractQuery } from './query.js';

export declare type DialectSupports = {
  'DEFAULT': boolean;
  'DEFAULT VALUES': boolean;
  'VALUES ()': boolean;
  'LIMIT ON UPDATE': boolean;
  'ON DUPLICATE KEY': boolean;
  'ORDER NULLS': boolean;
  'UNION': boolean;
  'UNION ALL': boolean;
  'RIGHT JOIN': boolean;
  EXCEPTION: boolean;
  forShare?: 'LOCK IN SHARE MODE' | 'FOR SHARE' | undefined;
  lock: boolean;
  lockOf: boolean;
  lockKey: boolean;
  lockOuterJoinFailure: boolean;
  skipLocked: boolean;
  finalTable: boolean;
  returnValues: false | {
    output: boolean;
    returning: boolean;
  };
  autoIncrement: {
    identityInsert: boolean;
    defaultValue: boolean;
    update: boolean;
  };
  bulkDefault: boolean;
  schemas: boolean;
  transactions: boolean;
  settingIsolationLevelDuringTransaction: boolean;
  transactionOptions: {
    type: boolean;
  };
  migrations: boolean;
  upserts: boolean;
  inserts: {
    ignoreDuplicates: string;
    updateOnDuplicate: boolean | string;
    onConflictDoNothing: string;
    onConflictWhere: boolean,
    conflictFields: boolean;
  };
  constraints: {
    restrict: boolean;
    addConstraint: boolean;
    dropConstraint: boolean;
    unique: boolean;
    default: boolean;
    check: boolean;
    foreignKey: boolean;
    primaryKey: boolean;
    onUpdate: boolean;
  };
  index: {
    collate: boolean;
    length: boolean;
    parser: boolean;
    concurrently: boolean;
    type: boolean;
    using: boolean | number;
    functionBased: boolean;
    operator: boolean;
    where: boolean;
  };
  groupedLimit: boolean;
  indexViaAlter: boolean;
  JSON: boolean;
  JSONB: boolean;
  ARRAY: boolean;
  RANGE: boolean;
  NUMERIC: boolean;
  GEOMETRY: boolean;
  GEOGRAPHY: boolean;
  REGEXP: boolean;
  /**
   * Case-insensitive regexp operator support ('~*' in postgres).
   */
  IREGEXP: boolean;
  HSTORE: boolean;
  TSVECTOR: boolean;
  deferrableConstraints: boolean;
  tmpTableTrigger: boolean;
  indexHints: boolean;
  searchPath: boolean;
  escapeStringConstants: boolean;
};

export declare abstract class AbstractDialect {
  /**
   * List of features this dialect supports.
   *
   * Important: Dialect implementations inherit these values.
   * When changing a default, ensure the implementations still properly declare which feature they support.
   */
  static readonly supports: DialectSupports;
  readonly defaultVersion: string;
  readonly Query: typeof AbstractQuery;
  readonly name: Dialect;
  readonly TICK_CHAR: string;
  readonly TICK_CHAR_LEFT: string;
  readonly TICK_CHAR_RIGHT: string;
  readonly queryGenerator: unknown;
  get supports(): DialectSupports;
  canBackslashEscape(): boolean;
}
