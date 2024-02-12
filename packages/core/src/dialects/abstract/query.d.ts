import type { IncludeOptions, Model, ModelStatic } from '../../model';
import type { QueryTypes } from '../../query-types';
import type { Sequelize } from '../../sequelize';
import type { Connection } from './connection-manager';

export interface AbstractQueryGroupJoinDataOptions {
  checkExisting: boolean;
}

export interface AbstractQueryOptions {
  instance?: Model;
  model?: ModelStatic;
  type?: QueryTypes;

  fieldMap?: boolean;
  plain: boolean;
  raw: boolean;
  nest: boolean;
  hasJoin: boolean;

  /**
   * A function that gets executed while running the query to log the sql.
   */
  logging?: boolean | ((sql: string, timing?: number) => void);
  queryLabel?: string;

  include: boolean;
  includeNames: unknown[];
  includeMap: any;

  originalAttributes: unknown[];
  attributes: unknown[];
}

export interface AbstractQueryFormatBindOptions {
  /**
   * skip unescaping $$
   */
  skipUnescape: boolean;

  /**
   * do not replace (but do unescape $$)
   */
  skipValueReplace: boolean;
}

/**
* An abstract class that Sequelize uses to add query support for a dialect.
*
* This interface is only exposed when running before/afterQuery lifecycle events.
*/
export class AbstractQuery {
  /**
   * The SQL being executed by this Query.
   */
  sql: string;

  /**
   * Returns a unique identifier assigned to a query internally by Sequelize.
   */
  uuid: unknown;

  /**
   * A Sequelize connection instance.
   */
  connection: Connection;

  /**
   * If provided, returns the model instance.
   */
  instance: Model;

  /**
   * Model type definition.
   */
  model: ModelStatic;

  /**
   * Returns the current sequelize instance.
   */
  sequelize: Sequelize;

  options: AbstractQueryOptions;

  constructor(connection: Connection, sequelize: Sequelize, options?: AbstractQueryOptions);

  /**
   * Execute the passed sql query.
   *
   * @private
   */
  private run(): Error;

  /**
   * Check the logging option of the instance and print deprecation warnings.
   *
   * @private
   */
  private checkLoggingOption(): void;

  /**
   * Get the attributes of an insert query, which contains the just inserted id.
   *
   * @returns {string} The field name.
   * @private
   */
  private getInsertIdField(): string;

  /**
   * Returns the unique constraint error message for the associated field.
   *
   * @param field the field name associated with the unique constraint.
   *
   * @returns The unique constraint error message.
   * @private
   */
  private getUniqueConstraintErrorMessage(field: string): string;

  /**
   * Checks if the query type is RAW
   */
  isRawQuery(): boolean;

  /**
   * Checks if the query type is UPSERT
   */
  isUpsertQuery(): boolean;

  /**
   * Checks if the query type is INSERT
   */
  isInsertQuery(results?: unknown[], metaData?: unknown): boolean;

  /**
   * Sets auto increment field values (if applicable).
   */
  handleInsertQuery(results?: unknown[], metaData?: unknown): void;

  /**
   * Checks if the query type is SHOWINDEXES
   */
  isShowIndexesQuery(): boolean;

  /**
   * Checks if the query type is SHOWCONSTRAINTS
   */
  isShowConstraintsQuery(): boolean;

  /**
   * Checks if the query type is DESCRIBE
   */
  isDescribeQuery(): boolean;

  /**
   * Checks if the query type is SELECT
   */
  isSelectQuery(): boolean;

  /**
   * Checks if the query type is BULKUPDATE
   */
  isBulkUpdateQuery(): boolean;

  /**
   * Checks if the query type is DELETE
   */
  isDeleteQuery(): boolean;

  /**
   * Checks if the query type is UPDATE
   */
  isUpdateQuery(): boolean;

  /**
   * Maps raw fields to attribute names (if applicable).
   *
   * @param results from a select query.
   * @returns the first model instance within the select.
   */
  handleSelectQuery(results: Model[]): Model;

  /**
   * Checks if the query starts with 'show' or 'describe'
   */
  isShowOrDescribeQuery(): boolean;

  /**
   * Checks if the query starts with 'call'
   */
  isCallQuery(): boolean;

  /**
   * @protected
   * @returns A function to call after the query was completed.
   */
  protected _logQuery(
    sql: string,
    debugContext: ((msg: string) => any),
    parameters: unknown[] | Record<string, unknown>
  ): () => void;

  /**
   * The function takes the result of the query execution and groups
   * the associated data by the callee.
   *
   * @example
   * ```ts
   * groupJoinData([
   *   {
   *     some: 'data',
   *     id: 1,
   *     association: { foo: 'bar', id: 1 }
   *   }, {
   *     some: 'data',
   *     id: 1,
   *     association: { foo: 'bar', id: 2 }
   *   }, {
   *     some: 'data',
   *     id: 1,
   *     association: { foo: 'bar', id: 3 }
   *   }
   * ]);
   * ```
   *
   * Results in:
   *
   * ```ts
   * [
   *   {
   *     some: 'data',
   *     id: 1,
   *     association: [
   *       { foo: 'bar', id: 1 },
   *       { foo: 'bar', id: 2 },
   *       { foo: 'bar', id: 3 }
   *     ]
   *   }
   * ]
   * ```
   *
   * @private
   */
  static _groupJoinData(
    rows: unknown[],
    includeOptions: IncludeOptions,
    options: AbstractQueryGroupJoinDataOptions,
  ): unknown[];
}
