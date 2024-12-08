import type { TableName, TableNameWithSchema } from './abstract-dialect/query-interface.js';

/**
 * Symbol to use for marking a model attribute as a temporal attribute
 * Do not export this symbol, it is for internal use only.
 *
 * @private
 */
export const TEMPORAL_SECRET = Symbol('temporal');

/**
 * History retention period unit options
 *
 * @property DAY
 * @property WEEK
 * @property MONTH
 * @property YEAR
 * @property INFINITE
 */
export enum HistoryRetentionPeriodUnit {
  DAY = 'DAY',
  WEEK = 'WEEK',
  MONTH = 'MONTH',
  YEAR = 'YEAR',
  INFINITE = 'INFINITE',
}

/**
 * Temporal time query types
 *
 * @property ALL
 * @property AS_OF
 * @property FROM_TO
 * @property BETWEEN
 * @property CONTAINED_IN
 */
export enum TemporalTimeQueryType {
  ALL = 'ALL',
  AS_OF = 'AS_OF',
  FROM_TO = 'FROM_TO',
  BETWEEN = 'BETWEEN',
  CONTAINED_IN = 'CONTAINED_IN',
}

/**
 * An enum of temporal table types
 *
 * @property APPLICATION_PERIOD
 * @property BITEMPORAL
 * @property NON_TEMPORAL
 * @property SYSTEM_PERIOD
 */
export enum TemporalTableType {
  APPLICATION_PERIOD = 'APPLICATION_PERIOD',
  BITEMPORAL = 'BITEMPORAL',
  NON_TEMPORAL = 'NON_TEMPORAL',
  SYSTEM_PERIOD = 'SYSTEM_PERIOD',
}

/**
 * An enum of temporal period types
 *
 * @property APPLICATION
 * @property SYSTEM
 */
export enum TemporalPeriodType {
  APPLICATION = 'APPLICATION',
  SYSTEM = 'SYSTEM',
}

/**
 * History retention period options
 */
export interface HistoryRetentionPeriod {
  length?: number | null;
  unit: HistoryRetentionPeriodUnit;
}

export interface TemporalTimeBaseOptions {
  period: TemporalTimeQueryType;
  type: 'BUSINESS_TIME' | 'SYSTEM_TIME';
}

export interface TemporalTimeAllOptions extends TemporalTimeBaseOptions {
  period: TemporalTimeQueryType.ALL;
}

export interface TemporalTimeAsOfOptions extends TemporalTimeBaseOptions {
  period: TemporalTimeQueryType.AS_OF;
  startDate: Date;
}

export interface TemporalTimeFromToOptions extends TemporalTimeBaseOptions {
  period: TemporalTimeQueryType.FROM_TO;
  startDate: Date;
  endDate: Date;
}

export interface TemporalTimeBetweenOptions extends TemporalTimeBaseOptions {
  period: TemporalTimeQueryType.BETWEEN;
  startDate: Date;
  endDate: Date;
}

export interface TemporalTimeContainedInOptions extends TemporalTimeBaseOptions {
  period: TemporalTimeQueryType.CONTAINED_IN;
  startDate: Date;
  endDate: Date;
}

/**
 * Temporal time options to use with find queries
 */
export type TemporalTimeFindOptions =
  | TemporalTimeAllOptions
  | TemporalTimeAsOfOptions
  | TemporalTimeFromToOptions
  | TemporalTimeBetweenOptions
  | TemporalTimeContainedInOptions;

/**
 * Temporal period definition
 */
export interface TemporalPeriodDefinition {
  /**
   * The name of the period
   */
  name: string;
  /**
   * The column name for the period start
   */
  rowEnd: string;
  /**
   * The column name for the period end
   */
  rowStart: string;
  /**
   * The period type
   */
  type: TemporalPeriodType;
}

/**
 * Temporal table definition
 */
export interface TemporalTableDefinition extends TableNameWithSchema {
  /**
   * The history table retention period for the temporal table.
   */
  historyRetentionPeriod?: HistoryRetentionPeriod;
  /**
   * The history table for the temporal table.
   */
  historyTable?: TableName;
  /**
   * The type of temporal table.
   */
  temporalTableType: TemporalTableType;
}

export interface TemporalTableOptions {
  /**
   * The type of temporal table.
   */
  temporalTableType: TemporalTableType;

  /**
   * The history table name for the temporal table.
   */
  historyTable?: TableName | undefined;

  /**
   * The history table retention period for the temporal table.
   */
  historyRetentionPeriod?: HistoryRetentionPeriod | undefined;

  /**
   * The application period start attribute.
   * {@link temporalTableType} must be APPLICATION_PERIOD or BITEMPORAL.
   *
   * Not affected by underscored setting.
   */
  applicationPeriodRowStart?: string | undefined;

  /**
   * The application period end attribute.
   * {@link temporalTableType} must be APPLICATION_PERIOD or BITEMPORAL.
   *
   * Not affected by underscored setting.
   */
  applicationPeriodRowEnd?: string | undefined;

  /**
   * Override the name of the system period row start attribute if a string is provided.
   * {@link temporalTableType} must be BITEMPORAL or SYSTEM_PERIOD.
   *
   * Not affected by underscored setting.
   */
  systemPeriodRowStart?: string | undefined;

  /**
   * Override the name of the system period row end attribute if a string is provided.
   * {@link temporalTableType} must be BITEMPORAL or SYSTEM_PERIOD.
   *
   * Not affected by underscored setting.
   */
  systemPeriodRowEnd?: string | undefined;
}
