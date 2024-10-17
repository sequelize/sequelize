import type { RequiredBy } from '@sequelize/utils';
import { EMPTY_OBJECT, isPlainObject, isString, join, map } from '@sequelize/utils';
import isObject from 'lodash/isObject';
import { randomUUID } from 'node:crypto';
import NodeUtil from 'node:util';
import type { Class } from 'type-fest';
import { ConstraintChecking } from '../deferrable.js';
import type { ParameterStyle } from '../enums.js';
import { IndexHints, TableHints } from '../enums.js';
import { AssociationPath } from '../expression-builders/association-path.js';
import { Attribute } from '../expression-builders/attribute.js';
import { BaseSqlExpression } from '../expression-builders/base-sql-expression.js';
import { Cast } from '../expression-builders/cast.js';
import { Col } from '../expression-builders/col.js';
import { DialectAwareFn } from '../expression-builders/dialect-aware-fn.js';
import { Fn } from '../expression-builders/fn.js';
import { Identifier } from '../expression-builders/identifier.js';
import { JsonPath } from '../expression-builders/json-path.js';
import { List } from '../expression-builders/list.js';
import { Literal } from '../expression-builders/literal.js';
import { Value } from '../expression-builders/value.js';
import { Where } from '../expression-builders/where.js';
import type { ModelDefinition } from '../model-definition.js';
import type { Attributes, Model, ModelStatic } from '../model.js';
import { Op } from '../operators.js';
import type { BindOrReplacements, Expression, Sequelize } from '../sequelize.js';
import type { NormalizedOptions } from '../sequelize.types.js';
import { bestGuessDataTypeOfVal } from '../sql-string.js';
import type { IsolationLevel } from '../transaction.js';
import { rejectInvalidOptions } from '../utils/check.js';
import { noOpCol } from '../utils/deprecations.js';
import { quoteIdentifier } from '../utils/dialect.js';
import { joinSQLFragments } from '../utils/join-sql-fragments.js';
import {
  extractModelDefinition,
  extractTableIdentifier,
  isModelStatic,
} from '../utils/model-utils.js';
import type { BindParamOptions, DataType } from './data-types.js';
import { AbstractDataType } from './data-types.js';
import type { AbstractDialect } from './dialect.js';
import { AbstractQueryGeneratorInternal } from './query-generator-internal.js';
import type {
  AddConstraintQueryOptions,
  BulkDeleteQueryOptions,
  CreateDatabaseQueryOptions,
  CreateSchemaQueryOptions,
  DropSchemaQueryOptions,
  DropTableQueryOptions,
  ListDatabasesQueryOptions,
  ListSchemasQueryOptions,
  ListTablesQueryOptions,
  QuoteTableOptions,
  RemoveColumnQueryOptions,
  RemoveConstraintQueryOptions,
  RemoveIndexQueryOptions,
  RenameTableQueryOptions,
  ShowConstraintsQueryOptions,
  StartTransactionQueryOptions,
  TableOrModel,
  TruncateTableQueryOptions,
} from './query-generator.types.js';
import type { TableNameWithSchema } from './query-interface.js';
import type { WhereOptions } from './where-sql-builder-types.js';
import type { WhereSqlBuilder } from './where-sql-builder.js';
import { PojoWhere } from './where-sql-builder.js';

export const CREATE_DATABASE_QUERY_SUPPORTABLE_OPTIONS = new Set<keyof CreateDatabaseQueryOptions>([
  'charset',
  'collate',
  'ctype',
  'encoding',
  'template',
]);
export const CREATE_SCHEMA_QUERY_SUPPORTABLE_OPTIONS = new Set<keyof CreateSchemaQueryOptions>([
  'authorization',
  'charset',
  'collate',
  'comment',
  'ifNotExists',
  'replace',
]);
export const DROP_SCHEMA_QUERY_SUPPORTABLE_OPTIONS = new Set<keyof DropSchemaQueryOptions>([
  'cascade',
  'ifExists',
]);
export const DROP_TABLE_QUERY_SUPPORTABLE_OPTIONS = new Set<keyof DropTableQueryOptions>([
  'cascade',
]);
export const LIST_DATABASES_QUERY_SUPPORTABLE_OPTIONS = new Set<keyof ListDatabasesQueryOptions>([
  'skip',
]);
export const LIST_TABLES_QUERY_SUPPORTABLE_OPTIONS = new Set<keyof ListTablesQueryOptions>([
  'schema',
]);
export const QUOTE_TABLE_SUPPORTABLE_OPTIONS = new Set<keyof QuoteTableOptions>([
  'indexHints',
  'tableHints',
]);
export const REMOVE_COLUMN_QUERY_SUPPORTABLE_OPTIONS = new Set<keyof RemoveColumnQueryOptions>([
  'ifExists',
  'cascade',
]);
export const REMOVE_CONSTRAINT_QUERY_SUPPORTABLE_OPTIONS = new Set<
  keyof RemoveConstraintQueryOptions
>(['ifExists', 'cascade']);
export const REMOVE_INDEX_QUERY_SUPPORTABLE_OPTIONS = new Set<keyof RemoveIndexQueryOptions>([
  'concurrently',
  'ifExists',
  'cascade',
]);
export const RENAME_TABLE_QUERY_SUPPORTABLE_OPTIONS = new Set<keyof RenameTableQueryOptions>([
  'changeSchema',
]);
export const SHOW_CONSTRAINTS_QUERY_SUPPORTABLE_OPTIONS = new Set<
  keyof ShowConstraintsQueryOptions
>(['columnName', 'constraintName', 'constraintType']);
export const START_TRANSACTION_QUERY_SUPPORTABLE_OPTIONS = new Set<
  keyof StartTransactionQueryOptions
>(['readOnly', 'transactionType']);
export const TRUNCATE_TABLE_QUERY_SUPPORTABLE_OPTIONS = new Set<keyof TruncateTableQueryOptions>([
  'cascade',
  'restartIdentity',
]);

/**
 * Options accepted by {@link AbstractQueryGeneratorTypeScript#escape}
 */
export interface EscapeOptions extends FormatWhereOptions {
  readonly type?: DataType | undefined;
}

export interface FormatWhereOptions extends Partial<BindParamOptions>, ParameterOptions {
  /**
   * The model of the main alias. Used to determine the type & column name of attributes referenced in the where clause.
   */
  readonly model?: ModelStatic | ModelDefinition | null | undefined;

  /**
   * The alias of the main table corresponding to {@link FormatWhereOptions.model}.
   * Used as the prefix for attributes that do not reference an association, e.g.
   *
   * ```ts
   * const where = { name: 'foo' };
   * ```
   *
   * will produce
   *
   * ```sql
   * WHERE "<mainAlias>"."name" = 'foo'
   * ```
   */
  readonly mainAlias?: string | undefined;
}

export interface ParameterOptions {
  /**
   * The style of parameter to use.
   */
  readonly parameterStyle?: ParameterStyle | `${ParameterStyle}` | undefined;
  /**
   * These are used to inline replacements into the query, when one is found inside of a {@link sql.literal}.
   */
  readonly replacements?: BindOrReplacements | undefined;
}

// DO NOT MAKE THIS CLASS PUBLIC!
/**
 * This is a temporary class used to progressively migrate the AbstractQueryGenerator class to TypeScript by slowly moving its functions here.
 * Always use {@link AbstractQueryGenerator} instead.
 */
export class AbstractQueryGeneratorTypeScript<Dialect extends AbstractDialect = AbstractDialect> {
  readonly dialect: Dialect;
  readonly #internals: AbstractQueryGeneratorInternal;

  constructor(
    dialect: Dialect,
    internals: AbstractQueryGeneratorInternal = new AbstractQueryGeneratorInternal(dialect),
  ) {
    this.dialect = dialect;
    this.#internals = internals;
  }

  get #whereGenerator(): WhereSqlBuilder {
    return this.#internals.whereSqlBuilder;
  }

  protected get sequelize(): Sequelize<Dialect> {
    return this.dialect.sequelize;
  }

  protected get options(): NormalizedOptions<Dialect> {
    return this.sequelize.options;
  }

  createDatabaseQuery(_database: string, _options?: CreateDatabaseQueryOptions): string {
    if (this.dialect.supports.multiDatabases) {
      throw new Error(
        `${this.dialect.name} declares supporting databases but createDatabaseQuery is not implemented.`,
      );
    }

    throw new Error(`Databases are not supported in ${this.dialect.name}.`);
  }

  dropDatabaseQuery(database: string): string {
    if (this.dialect.supports.multiDatabases) {
      return `DROP DATABASE IF EXISTS ${this.quoteIdentifier(database)}`;
    }

    throw new Error(`Databases are not supported in ${this.dialect.name}.`);
  }

  listDatabasesQuery(_options?: ListDatabasesQueryOptions): string {
    if (this.dialect.supports.multiDatabases) {
      throw new Error(
        `${this.dialect.name} declares supporting databases but listDatabasesQuery is not implemented.`,
      );
    }

    throw new Error(`Databases are not supported in ${this.dialect.name}.`);
  }

  createSchemaQuery(schemaName: string, options?: CreateSchemaQueryOptions): string {
    if (!this.dialect.supports.schemas) {
      throw new Error(`Schemas are not supported in ${this.dialect.name}.`);
    }

    if (options) {
      rejectInvalidOptions(
        'createSchemaQuery',
        this.dialect,
        CREATE_SCHEMA_QUERY_SUPPORTABLE_OPTIONS,
        this.dialect.supports.createSchema,
        options,
      );
    }

    return joinSQLFragments([
      'CREATE',
      options?.replace ? 'OR REPLACE' : '',
      'SCHEMA',
      options?.ifNotExists ? 'IF NOT EXISTS' : '',
      this.quoteIdentifier(schemaName),
      options?.authorization
        ? `AUTHORIZATION ${options.authorization instanceof Literal ? this.#internals.formatLiteral(options.authorization) : this.quoteIdentifier(options.authorization)}`
        : '',
      options?.charset ? `DEFAULT CHARACTER SET ${this.escape(options.charset)}` : '',
      options?.collate ? `DEFAULT COLLATE ${this.escape(options.collate)}` : '',
      options?.comment ? `COMMENT ${this.escape(options.comment)}` : '',
    ]);
  }

  dropSchemaQuery(schemaName: string, options?: DropSchemaQueryOptions): string {
    if (!this.dialect.supports.schemas) {
      throw new Error(`Schemas are not supported in ${this.dialect.name}.`);
    }

    if (options) {
      rejectInvalidOptions(
        'dropSchemaQuery',
        this.dialect,
        DROP_SCHEMA_QUERY_SUPPORTABLE_OPTIONS,
        this.dialect.supports.dropSchema,
        options,
      );
    }

    return joinSQLFragments([
      'DROP SCHEMA',
      options?.ifExists ? 'IF EXISTS' : '',
      this.quoteIdentifier(schemaName),
      options?.cascade ? 'CASCADE' : '',
    ]);
  }

  listSchemasQuery(_options?: ListSchemasQueryOptions): string {
    if (this.dialect.supports.schemas) {
      throw new Error(
        `${this.dialect.name} declares supporting schema but listSchemasQuery is not implemented.`,
      );
    }

    throw new Error(`Schemas are not supported in ${this.dialect.name}.`);
  }

  describeTableQuery(tableName: TableOrModel) {
    return `DESCRIBE ${this.quoteTable(tableName)};`;
  }

  dropTableQuery(tableName: TableOrModel, options?: DropTableQueryOptions): string {
    if (options) {
      rejectInvalidOptions(
        'dropTableQuery',
        this.dialect,
        DROP_TABLE_QUERY_SUPPORTABLE_OPTIONS,
        this.dialect.supports.dropTable,
        options,
      );
    }

    return joinSQLFragments([
      'DROP TABLE IF EXISTS',
      this.quoteTable(tableName),
      options?.cascade ? 'CASCADE' : '',
    ]);
  }

  listTablesQuery(_options?: ListTablesQueryOptions): string {
    throw new Error(`listTablesQuery has not been implemented in ${this.dialect.name}.`);
  }

  renameTableQuery(
    beforeTableName: TableOrModel,
    afterTableName: TableOrModel,
    options?: RenameTableQueryOptions,
  ): string {
    const beforeTable = this.extractTableDetails(beforeTableName);
    const afterTable = this.extractTableDetails(afterTableName);

    if (beforeTable.schema !== afterTable.schema && !options?.changeSchema) {
      throw new Error(
        'To move a table between schemas, you must set `options.changeSchema` to true.',
      );
    }

    return `ALTER TABLE ${this.quoteTable(beforeTableName)} RENAME TO ${this.quoteTable(afterTableName)}`;
  }

  truncateTableQuery(
    _tableName: TableOrModel,
    _options?: TruncateTableQueryOptions,
  ): string | string[] {
    throw new Error(`truncateTableQuery has not been implemented in ${this.dialect.name}.`);
  }

  removeColumnQuery(
    tableName: TableOrModel,
    columnName: string,
    options?: RemoveColumnQueryOptions,
  ): string {
    if (options) {
      rejectInvalidOptions(
        'removeColumnQuery',
        this.dialect,
        REMOVE_COLUMN_QUERY_SUPPORTABLE_OPTIONS,
        this.dialect.supports.removeColumn,
        options,
      );
    }

    return joinSQLFragments([
      'ALTER TABLE',
      this.quoteTable(tableName),
      'DROP COLUMN',
      options?.ifExists ? 'IF EXISTS' : '',
      this.quoteIdentifier(columnName),
      options?.cascade ? 'CASCADE' : '',
    ]);
  }

  addConstraintQuery(tableName: TableOrModel, options: AddConstraintQueryOptions): string {
    if (!this.dialect.supports.constraints.add) {
      throw new Error(`Add constraint queries are not supported by ${this.dialect.name} dialect`);
    }

    return joinSQLFragments([
      'ALTER TABLE',
      this.quoteTable(tableName),
      'ADD',
      this.#internals.getConstraintSnippet(tableName, options),
    ]);
  }

  removeConstraintQuery(
    tableName: TableOrModel,
    constraintName: string,
    options?: RemoveConstraintQueryOptions,
  ) {
    if (!this.dialect.supports.constraints.remove) {
      throw new Error(
        `Remove constraint queries are not supported by ${this.dialect.name} dialect`,
      );
    }

    if (options) {
      rejectInvalidOptions(
        'removeConstraintQuery',
        this.dialect,
        REMOVE_CONSTRAINT_QUERY_SUPPORTABLE_OPTIONS,
        this.dialect.supports.constraints.removeOptions,
        options,
      );
    }

    return joinSQLFragments([
      'ALTER TABLE',
      this.quoteTable(tableName),
      'DROP CONSTRAINT',
      options?.ifExists ? 'IF EXISTS' : '',
      this.quoteIdentifier(constraintName),
      options?.cascade ? 'CASCADE' : '',
    ]);
  }

  setConstraintCheckingQuery(type: ConstraintChecking): string;
  setConstraintCheckingQuery(
    type: Class<ConstraintChecking>,
    constraints?: readonly string[],
  ): string;
  setConstraintCheckingQuery(
    type: ConstraintChecking | Class<ConstraintChecking>,
    constraints?: readonly string[],
  ) {
    if (!this.dialect.supports.constraints.deferrable) {
      throw new Error(`Deferrable constraints are not supported by ${this.dialect.name} dialect`);
    }

    let constraintFragment = 'ALL';
    if (type instanceof ConstraintChecking) {
      if (type.constraints?.length) {
        constraintFragment = type.constraints
          .map(constraint => this.quoteIdentifier(constraint))
          .join(', ');
      }

      return `SET CONSTRAINTS ${constraintFragment} ${type.toString()}`;
    }

    if (constraints?.length) {
      constraintFragment = constraints
        .map(constraint => this.quoteIdentifier(constraint))
        .join(', ');
    }

    return `SET CONSTRAINTS ${constraintFragment} ${type.toString()}`;
  }

  showConstraintsQuery(_tableName: TableOrModel, _options?: ShowConstraintsQueryOptions): string {
    throw new Error(`showConstraintsQuery has not been implemented in ${this.dialect.name}.`);
  }

  showIndexesQuery(_tableName: TableOrModel): string {
    throw new Error(`showIndexesQuery has not been implemented in ${this.dialect.name}.`);
  }

  removeIndexQuery(
    _tableName: TableOrModel,
    _indexNameOrAttributes: string | string[],
    _options?: RemoveIndexQueryOptions,
  ): string {
    throw new Error(`removeIndexQuery has not been implemented in ${this.dialect.name}.`);
  }

  /**
   * Generates an SQL query that returns all foreign keys of a table or the foreign key constraint of a given column.
   *
   * @deprecated Use {@link showConstraintsQuery} instead.
   * @param _tableName The table or associated model.
   * @param _columnName The name of the column. Not supported by SQLite.
   * @returns The generated SQL query.
   */
  getForeignKeyQuery(_tableName: TableOrModel, _columnName?: string): Error {
    throw new Error(`getForeignKeyQuery has been deprecated. Use showConstraintsQuery instead.`);
  }

  /**
   * Generates an SQL query that drops a foreign key constraint.
   *
   * @deprecated Use {@link removeConstraintQuery} instead.
   * @param _tableName The table or associated model.
   * @param _foreignKey The name of the foreign key constraint.
   */
  dropForeignKeyQuery(_tableName: TableOrModel, _foreignKey: string): Error {
    throw new Error(`dropForeignKeyQuery has been deprecated. Use removeConstraintQuery instead.`);
  }

  /**
   * Returns a query that commits a transaction.
   */
  commitTransactionQuery(): string {
    if (this.dialect.supports.connectionTransactionMethods) {
      throw new Error(
        `commitTransactionQuery is not supported by the ${this.dialect.name} dialect.`,
      );
    }

    return 'COMMIT';
  }

  /**
   * Returns a query that creates a savepoint.
   *
   * @param savepointName
   */
  createSavepointQuery(savepointName: string): string {
    if (!this.dialect.supports.savepoints) {
      throw new Error(`Savepoints are not supported by ${this.dialect.name}.`);
    }

    return `SAVEPOINT ${this.quoteIdentifier(savepointName)}`;
  }

  /**
   * Returns a query that rollbacks a savepoint.
   *
   * @param savepointName
   */
  rollbackSavepointQuery(savepointName: string): string {
    if (!this.dialect.supports.savepoints) {
      throw new Error(`Savepoints are not supported by ${this.dialect.name}.`);
    }

    return `ROLLBACK TO SAVEPOINT ${this.quoteIdentifier(savepointName)}`;
  }

  /**
   * Returns a query that rollbacks a transaction.
   */
  rollbackTransactionQuery(): string {
    if (this.dialect.supports.connectionTransactionMethods) {
      throw new Error(
        `rollbackTransactionQuery is not supported by the ${this.dialect.name} dialect.`,
      );
    }

    return 'ROLLBACK';
  }

  /**
   * Returns a query that sets the transaction isolation level.
   *
   * @param isolationLevel
   */
  setIsolationLevelQuery(isolationLevel: IsolationLevel): string {
    if (!this.dialect.supports.isolationLevels) {
      throw new Error(`Isolation levels are not supported by ${this.dialect.name}.`);
    }

    if (!this.dialect.supports.connectionTransactionMethods) {
      return `SET TRANSACTION ISOLATION LEVEL ${isolationLevel}`;
    }

    throw new Error(`setIsolationLevelQuery is not supported by the ${this.dialect.name} dialect.`);
  }

  /**
   * Returns a query that starts a transaction.
   *
   * @param options
   */
  startTransactionQuery(options?: StartTransactionQueryOptions): string {
    if (this.dialect.supports.connectionTransactionMethods) {
      throw new Error(
        `startTransactionQuery is not supported by the ${this.dialect.name} dialect.`,
      );
    }

    if (options) {
      rejectInvalidOptions(
        'startTransactionQuery',
        this.dialect,
        START_TRANSACTION_QUERY_SUPPORTABLE_OPTIONS,
        this.dialect.supports.startTransaction,
        options,
      );
    }

    return joinSQLFragments([
      this.dialect.supports.startTransaction.useBegin ? 'BEGIN' : 'START',
      'TRANSACTION',
      options?.readOnly ? 'READ ONLY' : '',
    ]);
  }

  /**
   * Generates a unique identifier for the current transaction.
   */
  generateTransactionId(): string {
    return randomUUID();
  }

  // TODO: rename to "normalizeTable" & move to sequelize class
  extractTableDetails(
    tableOrModel: TableOrModel,
    options?: { schema?: string; delimiter?: string },
  ): RequiredBy<TableNameWithSchema, 'schema'> {
    const tableIdentifier = extractTableIdentifier(tableOrModel);

    if (!isPlainObject(tableIdentifier)) {
      throw new Error(
        `Invalid input received, got ${NodeUtil.inspect(tableOrModel)}, expected a Model Class, a TableNameWithSchema object, or a table name string`,
      );
    }

    return {
      ...tableIdentifier,
      schema:
        options?.schema ||
        tableIdentifier.schema ||
        this.options.schema ||
        this.dialect.getDefaultSchema(),
      delimiter: options?.delimiter || tableIdentifier.delimiter || '.',
    };
  }

  /**
   * Quote table name with optional alias and schema attribution
   *
   * @param param table string or object
   * @param options options
   */
  quoteTable(param: TableOrModel, options?: QuoteTableOptions): string {
    if (options) {
      rejectInvalidOptions(
        'quoteTable',
        this.dialect,
        QUOTE_TABLE_SUPPORTABLE_OPTIONS,
        {
          indexHints: this.dialect.supports.indexHints,
          tableHints: this.dialect.supports.tableHints,
        },
        options,
      );
    }

    if (isModelStatic(param)) {
      param = param.table;
    }

    const tableName = this.extractTableDetails(param);

    if (isObject(param) && ('as' in param || 'name' in param)) {
      throw new Error(
        'parameters "as" and "name" are not allowed in the first parameter of quoteTable, pass them as the second parameter.',
      );
    }

    let sql = '';

    if (this.dialect.supports.schemas) {
      // Some users sync the same set of tables in different schemas for various reasons
      // They then set `searchPath` when running a query to use different schemas.
      // See https://github.com/sequelize/sequelize/pull/15274#discussion_r1020770364
      // For this reason, we treat the default schema as equivalent to "no schema specified"
      if (tableName.schema && tableName.schema !== this.dialect.getDefaultSchema()) {
        sql += `${this.quoteIdentifier(tableName.schema)}.`;
      }

      sql += this.quoteIdentifier(tableName.tableName);
    } else {
      const fakeSchemaPrefix =
        tableName.schema && tableName.schema !== this.dialect.getDefaultSchema()
          ? tableName.schema + (tableName.delimiter || '.')
          : '';

      sql += this.quoteIdentifier(fakeSchemaPrefix + tableName.tableName);
    }

    if (options?.alias) {
      sql += ` AS ${this.quoteIdentifier(options.alias === true ? tableName.tableName : options.alias)}`;
    }

    if (options?.indexHints) {
      for (const hint of options.indexHints) {
        if (IndexHints[hint.type]) {
          sql += ` ${IndexHints[hint.type]} INDEX (${hint.values.map(indexName => this.quoteIdentifier(indexName)).join(',')})`;
        } else {
          throw new Error(
            `The index hint type "${hint.type}" is invalid or not supported by dialect "${this.dialect.name}".`,
          );
        }
      }
    }

    if (options?.tableHints) {
      const hints: TableHints[] = [];
      for (const hint of options.tableHints) {
        if (TableHints[hint]) {
          hints.push(TableHints[hint]);
        } else {
          throw new Error(
            `The table hint "${hint}" is invalid or not supported by dialect "${this.dialect.name}".`,
          );
        }
      }

      if (hints.length) {
        sql += ` WITH (${hints.join(', ')})`;
      }
    }

    return sql;
  }

  /**
   * Adds quotes to identifier
   *
   * @param identifier
   * @param _force
   */
  // TODO: memoize last result
  quoteIdentifier(identifier: string, _force?: boolean) {
    return quoteIdentifier(identifier, this.dialect.TICK_CHAR_LEFT, this.dialect.TICK_CHAR_RIGHT);
  }

  isSameTable(tableA: TableOrModel, tableB: TableOrModel) {
    if (tableA === tableB) {
      return true;
    }

    tableA = this.extractTableDetails(tableA);
    tableB = this.extractTableDetails(tableB);

    return tableA.tableName === tableB.tableName && tableA.schema === tableB.schema;
  }

  whereQuery<M extends Model>(where: WhereOptions<Attributes<M>>, options?: FormatWhereOptions) {
    const query = this.whereItemsQuery(where, options);
    if (query && query.length > 0) {
      return `WHERE ${query}`;
    }

    return '';
  }

  whereItemsQuery<M extends Model>(
    where: WhereOptions<Attributes<M>> | undefined,
    options?: FormatWhereOptions,
  ) {
    return this.#whereGenerator.formatWhereOptions(where, options);
  }

  formatSqlExpression(piece: BaseSqlExpression, options?: EscapeOptions): string {
    if (piece instanceof Literal) {
      return this.#internals.formatLiteral(piece, options);
    }

    if (piece instanceof Fn) {
      return this.#internals.formatFn(piece, options);
    }

    if (piece instanceof List) {
      return this.escapeList(piece.values, options);
    }

    if (piece instanceof Value) {
      return this.escape(piece.value, options);
    }

    if (piece instanceof Identifier) {
      return piece.values
        .map(value => {
          if (isString(value)) {
            return this.quoteIdentifier(value);
          }

          return this.quoteTable(value);
        })
        .join('.');
    }

    if (piece instanceof Cast) {
      return this.#internals.formatCast(piece, options);
    }

    if (piece instanceof Col) {
      return this.#internals.formatCol(piece, options);
    }

    if (piece instanceof Attribute) {
      return this.#internals.formatAttribute(piece, options);
    }

    if (piece instanceof Where) {
      if (piece.where instanceof PojoWhere) {
        return this.#whereGenerator.formatPojoWhere(piece.where, options);
      }

      return this.#whereGenerator.formatWhereOptions(piece.where, options);
    }

    if (piece instanceof JsonPath) {
      return this.#internals.formatJsonPath(piece, options);
    }

    if (piece instanceof AssociationPath) {
      return this.#internals.formatAssociationPath(piece);
    }

    if (piece instanceof DialectAwareFn) {
      return this.#internals.formatDialectAwareFn(piece, options);
    }

    throw new Error(`Unknown sequelize method ${piece.constructor.name}`);
  }

  /**
   * The goal of this method is to execute the equivalent of json_unquote for the current dialect.
   *
   * @param _arg
   * @param _options
   */
  formatUnquoteJson(_arg: Expression, _options: EscapeOptions | undefined): string {
    if (!this.dialect.supports.jsonOperations) {
      throw new Error(`Unquoting JSON is not supported by ${this.dialect.name} dialect.`);
    }

    throw new Error(`formatUnquoteJson has not been implemented in ${this.dialect.name}.`);
  }

  /**
   * @param _sqlExpression ⚠️ This is not an identifier, it's a raw SQL expression. It will be inlined in the query.
   * @param _path The JSON path, where each item is one level of the path
   * @param _unquote Whether the result should be unquoted (depending on dialect: ->> and #>> operators, json_unquote function). Defaults to `false`.
   */
  jsonPathExtractionQuery(
    _sqlExpression: string,
    _path: ReadonlyArray<number | string>,
    _unquote: boolean,
  ): string {
    if (!this.dialect.supports.jsonOperations) {
      throw new Error(`JSON Paths are not supported in ${this.dialect.name}.`);
    }

    throw new Error(`jsonPathExtractionQuery has not been implemented in ${this.dialect.name}.`);
  }

  /**
   * Escapes a value (e.g. a string, number or date) as an SQL value (as opposed to an identifier).
   *
   * @param value The value to escape
   * @param options The options to use when escaping the value
   */
  escape(value: unknown, options: EscapeOptions = EMPTY_OBJECT): string {
    if (isPlainObject(value) && Op.col in value) {
      noOpCol();
      value = new Col(value[Op.col] as string);
    }

    if (value instanceof BaseSqlExpression) {
      return this.formatSqlExpression(value, options);
    }

    if (value === undefined) {
      throw new TypeError('"undefined" cannot be escaped');
    }

    let { type } = options;
    if (type != null) {
      type = this.sequelize.normalizeDataType(type);
    }

    if (
      value === null &&
      // we handle null values ourselves by default, unless the data type explicitly accepts null
      (!(type instanceof AbstractDataType) || !type.acceptsNull())
    ) {
      if (options.bindParam) {
        return options.bindParam(null);
      }

      return 'NULL';
    }

    if (type == null || typeof type === 'string') {
      type = bestGuessDataTypeOfVal(value, this.dialect);
    } else {
      type = this.sequelize.normalizeDataType(type);
    }

    this.sequelize.validateValue(value, type);

    if (options.bindParam) {
      return type.getBindParamSql(value, options as BindParamOptions);
    }

    return type.escape(value);
  }

  /**
   * Escapes an array of values (e.g. strings, numbers or dates) as an SQL List of values.
   *
   * @param values The list of values to escape
   * @param options
   *
   * @example
   * ```ts
   * const values = [1, 2, 3];
   * queryGenerator.escapeList([1, 2, 3]); // '(1, 2, 3)'
   */
  escapeList(values: unknown[], options?: EscapeOptions): string {
    return `(${values.map(value => this.escape(value, options)).join(', ')})`;
  }

  getUuidV1FunctionCall(): string {
    if (!this.dialect.supports.uuidV1Generation) {
      throw new Error(`UUID V1 generation is not supported by ${this.dialect.name} dialect.`);
    }

    throw new Error(`getUuidV1FunctionCall has not been implemented in ${this.dialect.name}.`);
  }

  getUuidV4FunctionCall(): string {
    if (!this.dialect.supports.uuidV4Generation) {
      throw new Error(`UUID V4 generation is not supported by ${this.dialect.name} dialect.`);
    }

    throw new Error(`getUuidV4FunctionCall has not been implemented in ${this.dialect.name}.`);
  }

  getToggleForeignKeyChecksQuery(_enable: boolean): string {
    throw new Error(`${this.dialect.name} does not support toggling foreign key checks`);
  }

  versionQuery(): string {
    throw new Error(`${this.dialect.name} did not implement versionQuery`);
  }

  tableExistsQuery(tableName: TableOrModel): string {
    const table = this.extractTableDetails(tableName);

    return `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_NAME = ${this.escape(table.tableName)} AND TABLE_SCHEMA = ${this.escape(table.schema)}`;
  }

  bulkDeleteQuery(tableOrModel: TableOrModel, options: BulkDeleteQueryOptions): string {
    const table = this.quoteTable(tableOrModel);
    const modelDefinition = extractModelDefinition(tableOrModel);
    const whereOptions = { ...options, model: modelDefinition };
    const whereFragment = whereOptions.where
      ? this.whereQuery(whereOptions.where, whereOptions)
      : '';

    if (whereOptions.limit && !this.dialect.supports.delete.limit) {
      if (!modelDefinition) {
        throw new Error(
          'Using LIMIT in bulkDeleteQuery requires specifying a model or model definition.',
        );
      }

      const pks = join(
        map(modelDefinition.primaryKeysAttributeNames.values(), attrName =>
          this.quoteIdentifier(modelDefinition.getColumnName(attrName)),
        ),
        ', ',
      );

      const primaryKeys = modelDefinition.primaryKeysAttributeNames.size > 1 ? `(${pks})` : pks;

      return joinSQLFragments([
        `DELETE FROM ${table} WHERE ${primaryKeys} IN (`,
        `SELECT ${pks} FROM ${table}`,
        whereFragment,
        `ORDER BY ${pks}`,
        this.#internals.addLimitAndOffset(whereOptions),
        ')',
      ]);
    }

    return joinSQLFragments([
      `DELETE FROM ${this.quoteTable(tableOrModel)}`,
      whereFragment,
      this.#internals.addLimitAndOffset(whereOptions),
    ]);
  }

  __TEST__getInternals() {
    if (process.env.npm_lifecycle_event !== 'mocha') {
      throw new Error('You can only access the internals of the query generator in test mode.');
    }

    return this.#internals;
  }
}
