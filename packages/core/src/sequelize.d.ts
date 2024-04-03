import type { Options as RetryAsPromisedOptions } from 'retry-as-promised';
import type { DataTypes, Op, Options, QueryTypes } from '.';
import type { DataType } from './abstract-dialect/data-types.js';
import type { AbstractDialect, ConnectionOptions } from './abstract-dialect/dialect.js';
import type {
  ColumnsDescription,
  RawConstraintDescription,
} from './abstract-dialect/query-interface.types';
import type {
  BaseSqlExpression,
  DynamicSqlExpression,
} from './expression-builders/base-sql-expression.js';
import type { cast } from './expression-builders/cast.js';
import type { col } from './expression-builders/col.js';
import type { Fn, fn } from './expression-builders/fn.js';
import type { json } from './expression-builders/json.js';
import type { literal } from './expression-builders/literal.js';
import type { where } from './expression-builders/where.js';
import type {
  AttributeOptions,
  Attributes,
  ColumnReference,
  DropOptions,
  Hookable,
  Logging,
  Model,
  ModelAttributes,
  ModelOptions,
  ModelStatic,
  Poolable,
  Transactionable,
} from './model';
import type { SUPPORTED_DIALECTS } from './sequelize-typescript.js';
import { SequelizeTypeScript } from './sequelize-typescript.js';

export type RetryOptions = RetryAsPromisedOptions;

/**
 * Additional options for table altering during sync
 */
export interface SyncAlterOptions {
  /**
   * Prevents any drop statements while altering a table when set to `false`
   */
  drop?: boolean;
}

/**
 * Sync Options
 */
export interface SyncOptions extends Logging, Hookable {
  /**
   * If force is true, each DAO will do DROP TABLE IF EXISTS ..., before it tries to create its own table
   */
  force?: boolean;

  /**
   * If alter is true, each DAO will do ALTER TABLE ... CHANGE ...
   * Alters tables to fit models. Provide an object for additional configuration. Not recommended for production use. If not further configured deletes data in columns that were removed or had their type changed in the model.
   */
  alter?: boolean | SyncAlterOptions;

  /**
   * The schema that the tables should be created in. This can be overridden for each table in sequelize.define
   */
  schema?: string;

  /**
   * An optional parameter to specify the schema search_path (Postgres only)
   */
  searchPath?: string;
}

export interface DefaultSetOptions {}

/**
 * Interface for replication Options in the sequelize constructor
 */
export interface ReplicationOptions<Dialect extends AbstractDialect> {
  read: ReadonlyArray<RawConnectionOptions<Dialect>>;
  write?: RawConnectionOptions<Dialect>;
}

export type RawConnectionOptions<Dialect extends AbstractDialect> =
  | (ConnectionOptions<Dialect> & { url?: string })
  | string;

export interface NormalizedReplicationOptions<Dialect extends AbstractDialect> {
  /**
   * If empty, read-replication is not enabled,
   * and the "write" pool is used for all queries.
   */
  read: ReadonlyArray<ConnectionOptions<Dialect>>;
  write: ConnectionOptions<Dialect>;
}

export type DialectName = (typeof SUPPORTED_DIALECTS)[number];

export interface LegacyDialectOptions {
  [key: string]: any;
  account?: string;
  role?: string;
  warehouse?: string;
  schema?: string;
  odbcConnectionString?: string;
  charset?: string;
  timeout?: number;
  options?: string | Record<string, unknown>;
}

export interface SetSessionVariablesOptions extends Omit<QueryOptions, 'raw' | 'plain' | 'type'> {}

export type BindOrReplacements = { [key: string]: unknown } | unknown[];
type FieldMap = { [key: string]: string };

/**
 * Options for {@link Sequelize#queryRaw}.
 */
export interface QueryRawOptions extends Logging, Transactionable, Poolable {
  /**
   * If true, sequelize will not try to format the results of the query, or build an instance of a model from
   * the result
   */
  raw?: boolean;

  /**
   * The type of query you are executing. The query type affects how results are formatted before they are
   * passed back. The type is a string, but `Sequelize.QueryTypes` is provided as convenience shortcuts.
   */
  type?: string;

  /**
   * If true, transforms objects with `.` separated property names into nested objects using
   * [dottie.js](https://github.com/mickhansen/dottie.js). For example `{ 'user.username': 'john' }` becomes
   * `{ user: { username: 'john' }}`. When `nest` is true, the query type is assumed to be `'SELECT'`,
   * unless otherwise specified
   *
   * @default false
   */
  nest?: boolean;

  /**
   * Sets the query type to `SELECT` and return a single row
   */
  plain?: boolean;

  /**
   * Either an object of named parameter bindings in the format `$param` or an array of unnamed
   * values to bind to `$1`, `$2`, etc in your SQL.
   */
  bind?: BindOrReplacements;

  /**
   * A sequelize instance used to build the return instance
   */
  instance?: Model;

  /**
   * Map returned fields to model's fields if `options.model` or `options.instance` is present.
   * Mapping will occur before building the model instance.
   */
  mapToModel?: boolean;

  retry?: RetryOptions;

  /**
   * Map returned fields to arbitrary names for SELECT query type if `options.fieldMaps` is present.
   */
  fieldMap?: FieldMap;

  /**
   * If false do not prepend the query with the search_path (Postgres only)
   */
  supportsSearchPath?: boolean;
}

export interface QueryRawOptionsWithType<T extends QueryTypes> extends QueryRawOptions {
  type: T;
}

export interface QueryRawOptionsWithModel<M extends Model> extends QueryRawOptions {
  /**
   * A sequelize model used to build the returned model instances (used to be called callee)
   */
  model: ModelStatic<M>;
}

/**
 * Options for {@link Sequelize#query}.
 */
export interface QueryOptions extends QueryRawOptions {
  /**
   * Either an object of named parameter replacements in the format `:param` or an array of unnamed
   * replacements to replace `?` in your SQL.
   */
  replacements?: BindOrReplacements | undefined;
}

export interface QueryOptionsWithType<T extends QueryTypes> extends QueryOptions {
  type: T;
}

export interface QueryOptionsWithModel<M extends Model> extends QueryOptions {
  /**
   * A sequelize model used to build the returned model instances (used to be called callee)
   */
  model: ModelStatic<M>;
}

/**
 * This is the main class, the entry point to sequelize. To use it, you just need to
 * import sequelize:
 *
 * ```ts
 * import { Sequelize } from '@sequelize/core';
 * ```
 *
 * In addition to sequelize, the connection library for the dialect you want to use
 * should also be installed in your project. You don't need to import it however, as
 * sequelize will take care of that.
 */
export class Sequelize<
  Dialect extends AbstractDialect = AbstractDialect,
> extends SequelizeTypeScript<Dialect> {
  // -------------------- Utilities ------------------------------------------------------------------------

  /**
   * Creates a object representing a database function. This can be used in search queries, both in where and
   * order parts, and as default values in column definitions. If you want to refer to columns in your
   * function, you should use `sequelize.col`, so that the columns are properly interpreted as columns and
   * not a strings.
   *
   * Convert a user's username to upper case
   * ```ts
   * instance.update({
   *   username: fn('upper', col('username'))
   * })
   * ```
   *
   * @param fn The function you want to call
   * @param args All further arguments will be passed as arguments to the function
   *
   * @deprecated use top level {@link fn} instead
   * @hidden
   */
  static fn: typeof fn;
  /**
   * @deprecated use top level {@link fn} instead
   * @hidden
   */
  fn: typeof fn;

  /**
   * Creates a object representing a column in the DB. This is often useful in conjunction with
   * `sequelize.fn`, since raw string arguments to fn will be escaped.
   *
   * @param col The name of the column
   *
   * @deprecated use top level {@link col} instead
   * @hidden
   */
  static col: typeof col;
  /**
   * @deprecated use top level {@link col} instead
   * @hidden
   */
  col: typeof col;

  /**
   * Creates a object representing a call to the cast function.
   *
   * @param val The value to cast
   * @param type The type to cast it to
   *
   * @deprecated use top level {@link cast} instead
   * @hidden
   */
  static cast: typeof cast;
  /**
   * @deprecated use top level {@link cast} instead
   * @hidden
   */
  cast: typeof cast;

  /**
   * Creates a object representing a literal, i.e. something that will not be escaped.
   *
   * @param val
   *
   * @deprecated use top level {@link literal} instead
   * @hidden
   */
  static literal: typeof literal;
  /**
   * @deprecated use top level {@link literal} instead
   * @hidden
   */
  literal: typeof literal;

  /**
   * An AND query
   *
   * @param args Each argument will be joined by AND
   *
   * @deprecated use top level {@link and} instead
   * @hidden
   */
  static and: typeof and;
  /**
   * @deprecated use top level {@link and} instead
   * @hidden
   */
  and: typeof and;

  /**
   * An OR query
   *
   * @param args Each argument will be joined by OR
   *
   * @deprecated use top level {@link or} instead
   * @hidden
   */
  static or: typeof or;

  /**
   * @deprecated use top level {@link or} instead
   * @hidden
   */
  or: typeof or;

  /**
   * Creates an object representing nested where conditions for postgres's json data-type.
   *
   * @param conditionsOrPath A hash containing strings/numbers or other nested hash, a string using dot
   *   notation or a string using postgres json syntax.
   * @param value An optional value to compare against.
   *   Produces a string of the form "&lt;json path&gt; = '&lt;value&gt;'"`.
   *
   * @deprecated use top level {@link json} instead
   * @hidden
   */
  static json: typeof json;
  /**
   * @deprecated use top level {@link json} instead
   * @hidden
   */
  json: typeof json;

  /**
   * A way of specifying attr = condition.
   *
   * The attr can either be an object taken from `Model.rawAttributes` (for example `Model.rawAttributes.id`
   * or
   * `Model.rawAttributes.name`). The attribute should be defined in your model definition. The attribute can
   * also be an object from one of the sequelize utility functions (`sequelize.fn`, `sequelize.col` etc.)
   *
   * For string attributes, use the regular `{ where: { attr: something }}` syntax. If you don't want your
   * string to be escaped, use `sequelize.literal`.
   *
   * @param attr The attribute, which can be either an attribute object from `Model.rawAttributes` or a
   *   sequelize object, for example an instance of `sequelize.fn`. For simple string attributes, use the
   *   POJO syntax
   * @param comparator Comparator
   * @param logic The condition. Can be both a simply type, or a further condition (`.or`, `.and`, `.literal`
   *   etc.)
   *
   * @deprecated use top level {@link where} instead
   * @hidden
   */
  static where: typeof where;
  /**
   * @deprecated use top level {@link where} instead
   * @hidden
   */
  where: typeof where;

  /**
   * @deprecated use top level {@link Op} instead
   * @hidden
   */
  static Op: typeof Op;

  /**
   * @deprecated use top level {@link DataTypes} instead
   * @hidden
   */
  static DataTypes: typeof DataTypes;

  /**
   * A reference to Sequelize constructor from sequelize. Useful for accessing DataTypes, Errors etc.
   */
  Sequelize: typeof Sequelize;

  readonly dialect: Dialect;

  /**
   * @inheritDoc
   */
  constructor(options: Options<Dialect>);

  /**
   * Returns the specified dialect.
   */
  getDialect(): string;

  /**
   * Returns the database name.
   */

  getDatabaseName(): string;

  /**
   * Returns the dialect-dependant QueryInterface instance.
   */
  getQueryInterface(): Dialect['queryInterface'];

  /**
   * Define a new model, representing a table in the DB.
   *
   * The table columns are defined by the hash that is given as the second argument. Each attribute of the
   * hash
   * represents a column. A short table definition might look like this:
   *
   * ```js
   * class MyModel extends Model {}
   * MyModel.init({
   *   columnA: {
   *     type: DataTypes.BOOLEAN,
   *     validate: {
   *       is: ["[a-z]",'i'],    // will only allow letters
   *       max: 23,          // only allow values <= 23
   *       isIn: {
   *       args: [['en', 'zh']],
   *       msg: "Must be English or Chinese"
   *       }
   *     },
   *     field: 'column_a'
   *     // Other attributes here
   *   },
   *   columnB: DataTypes.STRING,
   *   columnC: 'MY VERY OWN COLUMN TYPE'
   * }, { sequelize })
   *
   * sequelize.models.modelName // The model will now be available in models under the name given to define
   * ```
   *
   * As shown above, column definitions can be either strings, a reference to one of the datatypes that are
   * predefined on the Sequelize constructor, or an object that allows you to specify both the type of the
   * column, and other attributes such as default values, foreign key constraints and custom setters and
   * getters.
   *
   * For a list of possible data types, see
   * https://sequelize.org/docs/v7/other-topics/other-data-types
   *
   * For more about getters and setters, see
   * https://sequelize.org/docs/v7/core-concepts/getters-setters-virtuals/
   *
   * For more about instance and class methods, see
   * https://sequelize.org/docs/v7/core-concepts/model-basics/#taking-advantage-of-models-being-classes
   *
   * For more about validation, see
   * https://sequelize.org/docs/v7/core-concepts/validations-and-constraints/
   *
   * @param modelName  The name of the model. The model will be stored in `sequelize.models` under this name
   * @param attributes An object, where each attribute is a column of the table. Each column can be either a
   *           DataType, a string or a type-description object, with the properties described below:
   * @param options  These options are merged with the default define options provided to the Sequelize
   *           constructor
   */
  define<M extends Model, TAttributes = Attributes<M>>(
    modelName: string,
    attributes?: ModelAttributes<M, TAttributes>,
    options?: ModelOptions<M>,
  ): ModelStatic<M>;

  /**
   * Fetch a Model which is already defined
   *
   * @param modelName The name of a model defined with Sequelize.define
   * @deprecated use {@link Sequelize#models} instead.
   */
  model<M extends Model = Model>(modelName: string): ModelStatic<M>;

  /**
   * Checks whether a model with the given name is defined
   *
   * @param modelName The name of a model defined with Sequelize.define
   * @deprecated use {@link Sequelize#models} instead.
   */
  isDefined(modelName: string): boolean;

  /**
   * Execute a query on the DB, optionally bypassing all the Sequelize goodness.
   *
   * By default, the function will return two arguments: an array of results, and a metadata object,
   * containing number of affected rows etc. Use `const [results, meta] = await ...` to access the results.
   *
   * If you are running a type of query where you don't need the metadata, for example a `SELECT` query, you
   * can pass in a query type to make sequelize format the results:
   *
   * ```js
   * const [results, metadata] = await sequelize.query('SELECT...'); // Raw query - use array destructuring
   *
   * const results = await sequelize.query('SELECT...', { type: sequelize.QueryTypes.SELECT }); // SELECT query - no destructuring
   * ```
   *
   * @param sql
   * @param options Query options
   */
  query(
    sql: string | BaseSqlExpression,
    options: QueryOptionsWithType<QueryTypes.UPDATE>,
  ): Promise<[undefined, number]>;
  query(
    sql: string | BaseSqlExpression,
    options: QueryOptionsWithType<QueryTypes.BULKUPDATE>,
  ): Promise<number>;
  query(
    sql: string | BaseSqlExpression,
    options: QueryOptionsWithType<QueryTypes.INSERT>,
  ): Promise<[number, number]>;
  query(
    sql: string | BaseSqlExpression,
    options: QueryOptionsWithType<QueryTypes.UPSERT>,
  ): Promise<number>;
  query(
    sql: string | BaseSqlExpression,
    options: QueryOptionsWithType<QueryTypes.DELETE>,
  ): Promise<number>;
  query(
    sql: string | BaseSqlExpression,
    options: QueryOptionsWithType<QueryTypes.DESCRIBE>,
  ): Promise<ColumnsDescription>;
  query(
    sql: string | BaseSqlExpression,
    options: QueryOptionsWithType<QueryTypes.SHOWCONSTRAINTS>,
  ): Promise<RawConstraintDescription[]>;
  query<M extends Model>(
    sql: string | BaseSqlExpression,
    options: QueryOptionsWithModel<M> & { plain: true },
  ): Promise<M | null>;
  query<M extends Model>(
    sql: string | BaseSqlExpression,
    options: QueryOptionsWithModel<M>,
  ): Promise<M[]>;
  query<T extends object>(
    sql: string | BaseSqlExpression,
    options: QueryOptionsWithType<QueryTypes.SELECT> & { plain: true },
  ): Promise<T | null>;
  query<T extends object>(
    sql: string | BaseSqlExpression,
    options: QueryOptionsWithType<QueryTypes.SELECT>,
  ): Promise<T[]>;
  query(
    sql: string | BaseSqlExpression,
    options: (QueryOptions | QueryOptionsWithType<QueryTypes.RAW>) & { plain: true },
  ): Promise<{ [key: string]: unknown } | null>;
  query(
    sql: string | BaseSqlExpression,
    options?: QueryOptions | QueryOptionsWithType<QueryTypes.RAW>,
  ): Promise<[unknown[], unknown]>;

  /**
   * Works like {@link Sequelize#query}, but does not inline replacements. Only bind parameters are supported.
   *
   * @param sql The SQL to execute
   * @param options The options for the query. See {@link QueryRawOptions} for details.
   */
  queryRaw(
    sql: string,
    options: QueryRawOptionsWithType<QueryTypes.UPDATE>,
  ): Promise<[undefined, number]>;
  queryRaw(sql: string, options: QueryRawOptionsWithType<QueryTypes.BULKUPDATE>): Promise<number>;
  queryRaw(
    sql: string,
    options: QueryRawOptionsWithType<QueryTypes.INSERT>,
  ): Promise<[number, number]>;
  queryRaw(sql: string, options: QueryRawOptionsWithType<QueryTypes.UPSERT>): Promise<number>;
  queryRaw(sql: string, options: QueryRawOptionsWithType<QueryTypes.DELETE>): Promise<number>;
  queryRaw(
    sql: string,
    options: QueryRawOptionsWithType<QueryTypes.DESCRIBE>,
  ): Promise<ColumnsDescription>;
  queryRaw(
    sql: string,
    options: QueryRawOptionsWithType<QueryTypes.SHOWCONSTRAINTS>,
  ): Promise<RawConstraintDescription[]>;
  queryRaw<M extends Model>(
    sql: string,
    options: QueryRawOptionsWithModel<M> & { plain: true },
  ): Promise<M | null>;
  queryRaw<M extends Model>(sql: string, options: QueryRawOptionsWithModel<M>): Promise<M[]>;
  queryRaw<T extends object>(
    sql: string,
    options: QueryRawOptionsWithType<QueryTypes.SELECT> & { plain: true },
  ): Promise<T | null>;
  queryRaw<T extends object>(
    sql: string,
    options: QueryRawOptionsWithType<QueryTypes.SELECT>,
  ): Promise<T[]>;
  queryRaw(
    sql: string,
    options: (QueryRawOptions | QueryRawOptionsWithType<QueryTypes.RAW>) & { plain: true },
  ): Promise<{ [key: string]: unknown } | null>;
  queryRaw(
    sql: string,
    options?: QueryRawOptions | QueryRawOptionsWithType<QueryTypes.RAW>,
  ): Promise<[unknown[], unknown]>;

  log(...values: unknown[]): void;

  /**
   * Get the fn for random based on the dialect
   */
  random(): Fn;

  /**
   * Execute a query which would set an environment or user variable. The variables are set per connection,
   * so this function needs a transaction.
   *
   * Only works for MySQL.
   *
   * @param variables object with multiple variables.
   * @param options Query options.
   */
  setSessionVariables(variables: object, options?: SetSessionVariablesOptions): Promise<unknown>;

  /**
   * Sync all defined models to the DB.
   *
   * @param options Sync Options
   */
  sync(options?: SyncOptions): Promise<this>;

  /**
   * Drop all tables defined through this sequelize instance. This is done by calling Model.drop on each model
   *
   * @param options The options passed to each call to Model.drop
   */
  drop(options?: DropOptions): Promise<unknown[]>;

  /**
   * Test the connection by trying to authenticate
   *
   * @param options Query Options for authentication
   */
  authenticate(options?: QueryOptions): Promise<void>;
  validate(options?: QueryOptions): Promise<void>;

  normalizeAttribute<M extends Model = Model>(
    attribute: AttributeOptions<M> | DataType,
  ): AttributeOptions<M>;

  /**
   * Returns the installed version of Sequelize
   */
  static get version(): string;
}

// Utilities

/**
 * An AND query
 *
 * @param args Each argument will be joined by AND
 */
export function and<T extends any[]>(...args: T): { [Op.and]: T };

/**
 * An OR query
 *
 * @param args Each argument will be joined by OR
 */
export function or<T extends any[]>(...args: T): { [Op.or]: T };

export type Expression = ColumnReference | DynamicSqlExpression | unknown;
