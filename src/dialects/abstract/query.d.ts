import { Connection } from './connection-manager';
import { Model, ModelType, IncludeOptions } from '../../model';
import { Sequelize } from '../../sequelize';
import QueryTypes = require('../../query-types');

type BindOrReplacements = { [key: string]: unknown } | unknown[];
type FieldMap = { [key: string]: string };


export interface AbstractQueryGroupJoinDataOptions {
  checkExisting: boolean;
}

export interface AbstractQueryOptions {
  instance?: Model;
  model?: ModelType;
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

type replacementFuncType = ((match: string, key: string, values: unknown[], timeZone?: string, dialect?: string, options?: AbstractQueryFormatBindOptions) => undefined | string);

/**
* An abstract class that Sequelize uses to add query support for a dialect.
*
* This interface is only exposed when running before/afterQuery lifecycle events.
*/
export class AbstractQuery {
  /**
   * Returns a unique identifier assigned to a query internally by Sequelize.
   */
  public uuid: unknown;

  /**
   * A Sequelize connection instance.
   *
   * @type {Connection}
   * @memberof AbstractQuery
   */
  public connection: Connection;

  /**
   * If provided, returns the model instance.
   *
   * @type {Model}
   * @memberof AbstractQuery
   */
  public instance: Model;

  /**
   * Model type definition.
   *
   * @type {ModelType}
   * @memberof AbstractQuery
   */
  public model: ModelType;

  /**
   * Returns the current sequelize instance.
   */
  public sequelize: Sequelize;

  /**
   *
   * @type {AbstractQueryOptions}
   * @memberof AbstractQuery
   */
  public options: AbstractQueryOptions;

  constructor(connection: Connection, sequelize: Sequelize, options?: AbstractQueryOptions);

  /**
   * rewrite query with parameters
   *
   * Examples:
   *
   *   query.formatBindParameters('select $1 as foo', ['fooval']);
   *
   *   query.formatBindParameters('select $foo as foo', { foo: 'fooval' });
   *
   * Options
   *   skipUnescape: bool, skip unescaping $$
   *   skipValueReplace: bool, do not replace (but do unescape $$). Check correct syntax and if all values are available
   *
   * @param {string} sql
   * @param {object|Array} values
   * @param {string} dialect
   * @param {Function} [replacementFunc]
   * @param {object} [options]
   * @private
   */
  static formatBindParameters(sql: string, values: object | Array<object>, dialect: string, replacementFunc: replacementFuncType, options: AbstractQueryFormatBindOptions): undefined | [string, unknown[]];

  /**
   * Execute the passed sql query.
   *
   * Examples:
   *
   *     query.run('SELECT 1')
   *
   * @private
   */
  private run(): Error

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
   * @param field {string} the field name associated with the unique constraint.
   *
   * @returns {string} The unique constraint error message.
   * @private
   */
  private getUniqueConstraintErrorMessage(field: string): string;

  /**
   * Checks if the query type is RAW
   *
   * @returns {boolean}
   */
  public isRawQuery(): boolean;

  /**
   * Checks if the query type is VERSION
   *
   * @returns {boolean}
   */
  public isVersionQuery(): boolean;

  /**
   * Checks if the query type is UPSERT
   *
   * @returns {boolean}
   */
  public isUpsertQuery(): boolean;

  /**
   * Checks if the query type is INSERT
   *
   * @returns {boolean}
   */
  public isInsertQuery(results?: unknown[], metaData?: unknown): boolean;

  /**
   * Sets auto increment field values (if applicable).
   *
   * @param results {Array}
   * @param metaData {object}
   * @returns {boolean}
   */
  public handleInsertQuery(results?: unknown[], metaData?: unknown): void;

  /**
   * Checks if the query type is SHOWTABLES
   *
   * @returns {boolean}
   */
  public isShowTablesQuery(): boolean;

  /**
   * Flattens and plucks values from results.
   *
   * @params {Array}
   * @returns {Array}
   */
  public handleShowTablesQuery(results: unknown[]): unknown[];

  /**
   * Checks if the query type is SHOWINDEXES
   *
   * @returns {boolean}
   */
  public isShowIndexesQuery(): boolean;

  /**
   * Checks if the query type is SHOWCONSTRAINTS
   *
   * @returns {boolean}
   */
  public isShowConstraintsQuery(): boolean;

  /**
   * Checks if the query type is DESCRIBE
   *
   * @returns {boolean}
   */
  public isDescribeQuery(): boolean;

  /**
   * Checks if the query type is SELECT
   *
   * @returns {boolean}
   */
  public isSelectQuery(): boolean;

  /**
   * Checks if the query type is BULKUPDATE
   *
   * @returns {boolean}
   */
  public isBulkUpdateQuery(): boolean;

  /**
   * Checks if the query type is BULKDELETE
   *
   * @returns {boolean}
   */
  public isBulkDeleteQuery(): boolean;

  /**
   * Checks if the query type is FOREIGNKEYS
   *
   * @returns {boolean}
   */
  public isForeignKeysQuery(): boolean;

  /**
   * Checks if the query type is UPDATE
   *
   * @returns {boolean}
   */
  public isUpdateQuery(): boolean;

  /**
   * Maps raw fields to attribute names (if applicable).
   *
   * @params {Model[]} results from a select query.
   * @returns {Model} the first model instance within the select.
   */
  public handleSelectQuery(results: Model[]): Model;

  /**
   * Checks if the query starts with 'show' or 'describe'
   *
   * @returns {boolean}
   */
  public isShowOrDescribeQuery(): boolean;

  /**
   * Checks if the query starts with 'call'
   *
   * @returns {boolean}
   */
  public isCallQuery(): boolean;

  /**
   * @param {string} sql
   * @param {Function} debugContext
   * @param {Array|object} parameters
   * @protected
   * @returns {Function} A function to call after the query was completed.
   */
  protected _logQuery(sql: string, debugContext: ((msg: string) => any), parameters: unknown[]): () => void;

  /**
   * The function takes the result of the query execution and groups
   * the associated data by the callee.
   *
   * Example:
   *   groupJoinData([
   *     {
   *       some: 'data',
   *       id: 1,
   *       association: { foo: 'bar', id: 1 }
   *     }, {
   *       some: 'data',
   *       id: 1,
   *       association: { foo: 'bar', id: 2 }
   *     }, {
   *       some: 'data',
   *       id: 1,
   *       association: { foo: 'bar', id: 3 }
   *     }
   *   ])
   *
   * Result:
   *   Something like this:
   *
   *   [
   *     {
   *       some: 'data',
   *       id: 1,
   *       association: [
   *         { foo: 'bar', id: 1 },
   *         { foo: 'bar', id: 2 },
   *         { foo: 'bar', id: 3 }
   *       ]
   *     }
   *   ]
   *
   * @param {Array} rows
   * @param {object} includeOptions
   * @param {object} options
   * @private
   */
  static _groupJoinData(rows: unknown[], includeOptions: IncludeOptions, options: AbstractQueryGroupJoinDataOptions): unknown[];
}
