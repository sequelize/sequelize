import NodeUtil from 'node:util';
import isObject from 'lodash/isObject';
import type { Class } from 'type-fest';
import { ConstraintChecking } from '../../deferrable.js';
import { AssociationPath } from '../../expression-builders/association-path.js';
import { Attribute } from '../../expression-builders/attribute.js';
import { BaseSqlExpression } from '../../expression-builders/base-sql-expression.js';
import { Cast } from '../../expression-builders/cast.js';
import { Col } from '../../expression-builders/col.js';
import { DialectAwareFn } from '../../expression-builders/dialect-aware-fn.js';
import { Fn } from '../../expression-builders/fn.js';
import { Identifier } from '../../expression-builders/identifier.js';
import { JsonPath } from '../../expression-builders/json-path.js';
import { List } from '../../expression-builders/list.js';
import { Literal } from '../../expression-builders/literal.js';
import { Value } from '../../expression-builders/value.js';
import { Where } from '../../expression-builders/where.js';
import { IndexHints } from '../../index-hints.js';
import type { AttributeOptions, Attributes, Model, ModelStatic } from '../../model.js';
import { Op } from '../../operators.js';
import type { BindOrReplacements, Expression } from '../../sequelize.js';
import { bestGuessDataTypeOfVal } from '../../sql-string.js';
import { TableHints } from '../../table-hints.js';
import { isPlainObject, isString, rejectInvalidOptions } from '../../utils/check.js';
import { noOpCol } from '../../utils/deprecations.js';
import { quoteIdentifier } from '../../utils/dialect.js';
import { removeNullishValuesFromArray, removeNullishValuesFromHash } from '../../utils/format.js';
import { joinSQLFragments } from '../../utils/join-sql-fragments.js';
import { isModelStatic } from '../../utils/model-utils.js';
import { EMPTY_OBJECT } from '../../utils/object.js';
import { AbstractDataType } from './data-types.js';
import type { BindParamOptions, DataType } from './data-types.js';
import { AbstractQueryGeneratorInternal } from './query-generator-internal.js';
import type {
  AddConstraintQueryOptions,
  BulkDeleteQueryOptions,
  BulkInsertQueryOptions,
  CreateDatabaseQueryOptions,
  CreateSchemaQueryOptions,
  DropSchemaQueryOptions,
  DropTableQueryOptions,
  InsertQueryOptions,
  ListDatabasesQueryOptions,
  ListSchemasQueryOptions,
  ListTablesQueryOptions,
  QuoteTableOptions,
  RemoveColumnQueryOptions,
  RemoveConstraintQueryOptions,
  RenameTableQueryOptions,
  ShowConstraintsQueryOptions,
  TruncateTableQueryOptions,
} from './query-generator.types.js';
import type { TableName, TableNameWithSchema } from './query-interface.js';
import type { WhereOptions } from './where-sql-builder-types.js';
import type { WhereSqlBuilder } from './where-sql-builder.js';
import { PojoWhere } from './where-sql-builder.js';
import type { AbstractDialect } from './index.js';

export type TableNameOrModel = TableName | ModelStatic;

// keep REMOVE_INDEX_QUERY_SUPPORTABLE_OPTIONS updated when modifying this
export interface RemoveIndexQueryOptions {
  concurrently?: boolean;
  ifExists?: boolean;
  cascade?: boolean;
}

export const BULK_INSERT_QUERY_SUPPORTABLE_OPTIONS = new Set<keyof BulkInsertQueryOptions>(['conflictWhere', 'ignoreDuplicates', 'returning', 'updateOnDuplicate']);
export const CREATE_DATABASE_QUERY_SUPPORTABLE_OPTIONS = new Set<keyof CreateDatabaseQueryOptions>(['charset', 'collate', 'ctype', 'encoding', 'template']);
export const CREATE_SCHEMA_QUERY_SUPPORTABLE_OPTIONS = new Set<keyof CreateSchemaQueryOptions>(['authorization', 'charset', 'collate', 'comment', 'ifNotExists', 'replace']);
export const DROP_SCHEMA_QUERY_SUPPORTABLE_OPTIONS = new Set<keyof DropSchemaQueryOptions>(['cascade', 'ifExists']);
export const DROP_TABLE_QUERY_SUPPORTABLE_OPTIONS = new Set<keyof DropTableQueryOptions>(['cascade']);
export const INSERT_QUERY_SUPPORTABLE_OPTIONS = new Set<keyof InsertQueryOptions>(['conflictWhere', 'exception', 'ignoreDuplicates', 'returning', 'updateOnDuplicate']);
export const LIST_DATABASES_QUERY_SUPPORTABLE_OPTIONS = new Set<keyof ListDatabasesQueryOptions>(['skip']);
export const LIST_TABLES_QUERY_SUPPORTABLE_OPTIONS = new Set<keyof ListTablesQueryOptions>(['schema']);
export const QUOTE_TABLE_SUPPORTABLE_OPTIONS = new Set<keyof QuoteTableOptions>(['indexHints', 'tableHints']);
export const REMOVE_COLUMN_QUERY_SUPPORTABLE_OPTIONS = new Set<keyof RemoveColumnQueryOptions>(['ifExists', 'cascade']);
export const REMOVE_CONSTRAINT_QUERY_SUPPORTABLE_OPTIONS = new Set<keyof RemoveConstraintQueryOptions>(['ifExists', 'cascade']);
export const REMOVE_INDEX_QUERY_SUPPORTABLE_OPTIONS = new Set<keyof RemoveIndexQueryOptions>(['concurrently', 'ifExists', 'cascade']);
export const RENAME_TABLE_QUERY_SUPPORTABLE_OPTIONS = new Set<keyof RenameTableQueryOptions>(['changeSchema']);
export const SHOW_CONSTRAINTS_QUERY_SUPPORTABLE_OPTIONS = new Set<keyof ShowConstraintsQueryOptions>(['columnName', 'constraintName', 'constraintType']);
export const TRUNCATE_TABLE_QUERY_SUPPORTABLE_OPTIONS = new Set<keyof TruncateTableQueryOptions>(['cascade', 'restartIdentity']);

/**
 * Options accepted by {@link AbstractQueryGeneratorTypeScript#escape}
 */
export interface EscapeOptions extends FormatWhereOptions {
  readonly type?: DataType | undefined;
}

export interface FormatWhereOptions extends Bindable {
  /**
   * These are used to inline replacements into the query, when one is found inside of a {@link Literal}.
   */
  readonly replacements?: BindOrReplacements | undefined;

  /**
   * The model of the main alias. Used to determine the type & column name of attributes referenced in the where clause.
   */
  readonly model?: ModelStatic | undefined;

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

/**
 * Methods that support this option are functions that add values to the query.
 * If {@link Bindable.bindParam} is specified, the value will be added to the query as a bind parameter.
 * If it is not specified, the value will be added to the query as a literal.
 */
export interface Bindable {
  bindParam?: ((value: unknown) => string) | undefined;
}

export interface QueryWithBindParams {
  query: string;
  bind?: Record<string, unknown> | undefined;
}

// DO NOT MAKE THIS CLASS PUBLIC!
/**
 * This is a temporary class used to progressively migrate the AbstractQueryGenerator class to TypeScript by slowly moving its functions here.
 * Always use {@link AbstractQueryGenerator} instead.
 */
export class AbstractQueryGeneratorTypeScript {
  readonly dialect: AbstractDialect;
  readonly #internals: AbstractQueryGeneratorInternal;

  constructor(
    dialect: AbstractDialect,
    internals: AbstractQueryGeneratorInternal = new AbstractQueryGeneratorInternal(dialect),
  ) {
    this.dialect = dialect;
    this.#internals = internals;
  }

  get #whereGenerator(): WhereSqlBuilder {
    return this.#internals.whereSqlBuilder;
  }

  protected get sequelize() {
    return this.dialect.sequelize;
  }

  protected get options() {
    return this.sequelize.options;
  }

  createDatabaseQuery(_database: string, _options?: CreateDatabaseQueryOptions): string {
    if (this.dialect.supports.multiDatabases) {
      throw new Error(`${this.dialect.name} declares supporting databases but createDatabaseQuery is not implemented.`);
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
      throw new Error(`${this.dialect.name} declares supporting databases but listDatabasesQuery is not implemented.`);
    }

    throw new Error(`Databases are not supported in ${this.dialect.name}.`);
  }

  createSchemaQuery(schemaName: string, options?: CreateSchemaQueryOptions): string {
    if (!this.dialect.supports.schemas) {
      throw new Error(`Schemas are not supported in ${this.dialect.name}.`);
    }

    if (options) {
      const CREATE_SCHEMA_QUERY_SUPPORTED_OPTIONS = new Set<keyof CreateSchemaQueryOptions>();
      if (this.dialect.supports.createSchema.authorization) {
        CREATE_SCHEMA_QUERY_SUPPORTED_OPTIONS.add('authorization');
      }

      if (this.dialect.supports.createSchema.charset) {
        CREATE_SCHEMA_QUERY_SUPPORTED_OPTIONS.add('charset');
      }

      if (this.dialect.supports.createSchema.collate) {
        CREATE_SCHEMA_QUERY_SUPPORTED_OPTIONS.add('collate');
      }

      if (this.dialect.supports.createSchema.comment) {
        CREATE_SCHEMA_QUERY_SUPPORTED_OPTIONS.add('comment');
      }

      if (this.dialect.supports.createSchema.ifNotExists) {
        CREATE_SCHEMA_QUERY_SUPPORTED_OPTIONS.add('ifNotExists');
      }

      if (this.dialect.supports.createSchema.replace) {
        CREATE_SCHEMA_QUERY_SUPPORTED_OPTIONS.add('replace');
      }

      rejectInvalidOptions(
        'createSchemaQuery',
        this.dialect.name,
        CREATE_SCHEMA_QUERY_SUPPORTABLE_OPTIONS,
        CREATE_SCHEMA_QUERY_SUPPORTED_OPTIONS,
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
      const DROP_SCHEMA_QUERY_SUPPORTED_OPTIONS = new Set<keyof DropSchemaQueryOptions>();
      if (this.dialect.supports.dropSchema.cascade) {
        DROP_SCHEMA_QUERY_SUPPORTED_OPTIONS.add('cascade');
      }

      if (this.dialect.supports.dropSchema.ifExists) {
        DROP_SCHEMA_QUERY_SUPPORTED_OPTIONS.add('ifExists');
      }

      rejectInvalidOptions(
        'dropSchemaQuery',
        this.dialect.name,
        DROP_SCHEMA_QUERY_SUPPORTABLE_OPTIONS,
        DROP_SCHEMA_QUERY_SUPPORTED_OPTIONS,
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
      throw new Error(`${this.dialect.name} declares supporting schema but listSchemasQuery is not implemented.`);
    }

    throw new Error(`Schemas are not supported in ${this.dialect.name}.`);
  }

  describeTableQuery(tableName: TableNameOrModel) {
    return `DESCRIBE ${this.quoteTable(tableName)};`;
  }

  dropTableQuery(tableName: TableNameOrModel, options?: DropTableQueryOptions): string {
    const DROP_TABLE_QUERY_SUPPORTED_OPTIONS = new Set<keyof DropTableQueryOptions>();

    if (this.dialect.supports.dropTable.cascade) {
      DROP_TABLE_QUERY_SUPPORTED_OPTIONS.add('cascade');
    }

    if (options) {
      rejectInvalidOptions(
        'dropTableQuery',
        this.dialect.name,
        DROP_TABLE_QUERY_SUPPORTABLE_OPTIONS,
        DROP_TABLE_QUERY_SUPPORTED_OPTIONS,
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
    beforeTableName: TableNameOrModel,
    afterTableName: TableNameOrModel,
    options?: RenameTableQueryOptions,
  ): string {
    const beforeTable = this.extractTableDetails(beforeTableName);
    const afterTable = this.extractTableDetails(afterTableName);

    if (beforeTable.schema !== afterTable.schema && !options?.changeSchema) {
      throw new Error('To move a table between schemas, you must set `options.changeSchema` to true.');
    }

    return `ALTER TABLE ${this.quoteTable(beforeTableName)} RENAME TO ${this.quoteTable(afterTableName)}`;
  }

  truncateTableQuery(_tableName: TableNameOrModel, _options?: TruncateTableQueryOptions): string | string[] {
    throw new Error(`truncateTableQuery has not been implemented in ${this.dialect.name}.`);
  }

  removeColumnQuery(tableName: TableNameOrModel, columnName: string, options?: RemoveColumnQueryOptions): string {
    if (options) {
      const REMOVE_COLUMN_QUERY_SUPPORTED_OPTIONS = new Set<keyof RemoveColumnQueryOptions>();

      if (this.dialect.supports.removeColumn.cascade) {
        REMOVE_COLUMN_QUERY_SUPPORTED_OPTIONS.add('cascade');
      }

      if (this.dialect.supports.removeColumn.ifExists) {
        REMOVE_COLUMN_QUERY_SUPPORTED_OPTIONS.add('ifExists');
      }

      rejectInvalidOptions(
        'removeColumnQuery',
        this.dialect.name,
        REMOVE_COLUMN_QUERY_SUPPORTABLE_OPTIONS,
        REMOVE_COLUMN_QUERY_SUPPORTED_OPTIONS,
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

  addConstraintQuery(tableName: TableNameOrModel, options: AddConstraintQueryOptions): string {
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

  removeConstraintQuery(tableName: TableNameOrModel, constraintName: string, options?: RemoveConstraintQueryOptions) {
    if (!this.dialect.supports.constraints.remove) {
      throw new Error(`Remove constraint queries are not supported by ${this.dialect.name} dialect`);
    }

    if (options) {
      const REMOVE_CONSTRAINT_QUERY_SUPPORTED_OPTIONS = new Set<keyof RemoveConstraintQueryOptions>();
      const { removeOptions } = this.dialect.supports.constraints;
      if (removeOptions.cascade) {
        REMOVE_CONSTRAINT_QUERY_SUPPORTED_OPTIONS.add('cascade');
      }

      if (removeOptions.ifExists) {
        REMOVE_CONSTRAINT_QUERY_SUPPORTED_OPTIONS.add('ifExists');
      }

      rejectInvalidOptions(
        'removeConstraintQuery',
        this.dialect.name,
        REMOVE_CONSTRAINT_QUERY_SUPPORTABLE_OPTIONS,
        REMOVE_CONSTRAINT_QUERY_SUPPORTED_OPTIONS,
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
  setConstraintCheckingQuery(type: Class<ConstraintChecking>, constraints?: readonly string[]): string;
  setConstraintCheckingQuery(type: ConstraintChecking | Class<ConstraintChecking>, constraints?: readonly string[]) {
    if (!this.dialect.supports.constraints.deferrable) {
      throw new Error(`Deferrable constraints are not supported by ${this.dialect.name} dialect`);
    }

    let constraintFragment = 'ALL';
    if (type instanceof ConstraintChecking) {
      if (type.constraints?.length) {
        constraintFragment = type.constraints.map(constraint => this.quoteIdentifier(constraint)).join(', ');
      }

      return `SET CONSTRAINTS ${constraintFragment} ${type.toString()}`;
    }

    if (constraints?.length) {
      constraintFragment = constraints.map(constraint => this.quoteIdentifier(constraint)).join(', ');
    }

    return `SET CONSTRAINTS ${constraintFragment} ${type.toString()}`;
  }

  showConstraintsQuery(_tableName: TableNameOrModel, _options?: ShowConstraintsQueryOptions): string {
    throw new Error(`showConstraintsQuery has not been implemented in ${this.dialect.name}.`);
  }

  showIndexesQuery(_tableName: TableNameOrModel): string {
    throw new Error(`showIndexesQuery has not been implemented in ${this.dialect.name}.`);
  }

  removeIndexQuery(
    _tableName: TableNameOrModel,
    _indexNameOrAttributes: string | string [],
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
  getForeignKeyQuery(_tableName: TableNameOrModel, _columnName?: string): Error {
    throw new Error(`getForeignKeyQuery has been deprecated. Use showConstraintsQuery instead.`);
  }

  /**
   * Generates an SQL query that drops a foreign key constraint.
   *
   * @deprecated Use {@link removeConstraintQuery} instead.
   * @param _tableName The table or associated model.
   * @param _foreignKey The name of the foreign key constraint.
   */
  dropForeignKeyQuery(_tableName: TableNameOrModel, _foreignKey: string): Error {
    throw new Error(`dropForeignKeyQuery has been deprecated. Use removeConstraintQuery instead.`);
  }

  // TODO: rename to "normalizeTable" & move to sequelize class
  extractTableDetails(
    tableNameOrModel: TableNameOrModel,
    options?: { schema?: string, delimiter?: string },
  ): TableNameWithSchema {
    const tableNameObject = isModelStatic(tableNameOrModel) ? tableNameOrModel.getTableName()
      : isString(tableNameOrModel) ? { tableName: tableNameOrModel }
      : tableNameOrModel;

    if (!isPlainObject(tableNameObject)) {
      throw new Error(`Invalid input received, got ${NodeUtil.inspect(tableNameOrModel)}, expected a Model Class, a TableNameWithSchema object, or a table name string`);
    }

    // @ts-expect-error -- TODO: this is added by getTableName on model, and must be removed
    delete tableNameObject.toString;

    return {
      ...tableNameObject,
      schema: options?.schema || tableNameObject.schema || this.options.schema || this.dialect.getDefaultSchema(),
      delimiter: options?.delimiter || tableNameObject.delimiter || '.',
    };
  }

  /**
   * Quote table name with optional alias and schema attribution
   *
   * @param param table string or object
   * @param options options
   */
  quoteTable(param: TableNameOrModel, options?: QuoteTableOptions): string {
    const QUOTE_TABLE_SUPPORTED_OPTIONS = new Set<keyof QuoteTableOptions>();
    if (this.dialect.supports.indexHints) {
      QUOTE_TABLE_SUPPORTED_OPTIONS.add('indexHints');
    }

    if (this.dialect.supports.tableHints) {
      QUOTE_TABLE_SUPPORTED_OPTIONS.add('tableHints');
    }

    rejectInvalidOptions('quoteTable', this.dialect.name, QUOTE_TABLE_SUPPORTABLE_OPTIONS, QUOTE_TABLE_SUPPORTED_OPTIONS, { ...options });

    if (isModelStatic(param)) {
      param = param.getTableName();
    }

    const tableName = this.extractTableDetails(param);

    if (isObject(param) && ('as' in param || 'name' in param)) {
      throw new Error('parameters "as" and "name" are not allowed in the first parameter of quoteTable, pass them as the second parameter.');
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
      const fakeSchemaPrefix = (tableName.schema && tableName.schema !== this.dialect.getDefaultSchema())
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
          throw new Error(`The index hint type "${hint.type}" is invalid or not supported by dialect "${this.dialect.name}".`);
        }
      }
    }

    if (options?.tableHints) {
      const hints: TableHints[] = [];
      for (const hint of options.tableHints) {
        if (TableHints[hint]) {
          hints.push(TableHints[hint]);
        } else {
          throw new Error(`The table hint "${hint}" is invalid or not supported by dialect "${this.dialect.name}".`);
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

  isSameTable(tableA: TableNameOrModel, tableB: TableNameOrModel) {
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

  whereItemsQuery<M extends Model>(where: WhereOptions<Attributes<M>> | undefined, options?: FormatWhereOptions) {
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
      return this.quoteIdentifier(piece.value);
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
  jsonPathExtractionQuery(_sqlExpression: string, _path: ReadonlyArray<number | string>, _unquote: boolean): string {
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
      value === null
      // we handle null values ourselves by default, unless the data type explicitly accepts null
      && (!(type instanceof AbstractDataType) || !type.acceptsNull())
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

  tableExistsQuery(tableName: TableNameOrModel): string {
    const table = this.extractTableDetails(tableName);

    return `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_NAME = ${this.escape(table.tableName)} AND TABLE_SCHEMA = ${this.escape(table.schema)}`;
  }

  bulkDeleteQuery(tableName: TableNameOrModel, options: BulkDeleteQueryOptions): string {
    const table = this.quoteTable(tableName);
    const whereOptions = isModelStatic(tableName) ? { ...options, model: tableName } : options;

    if (options.limit && this.dialect.supports.delete.modelWithLimit) {
      if (!isModelStatic(tableName)) {
        throw new Error('Cannot use LIMIT with bulkDeleteQuery without a model.');
      }

      const pks = Object.values(tableName.primaryKeys).map(key => this.quoteIdentifier(key.columnName)).join(', ');
      const primaryKeys = Object.values(tableName.primaryKeys).length > 1 ? `(${pks})` : pks;

      return joinSQLFragments([
        `DELETE FROM ${table} WHERE ${primaryKeys} IN (`,
        `SELECT ${pks} FROM ${table}`,
        options.where ? this.whereQuery(options.where, whereOptions) : '',
        `ORDER BY ${pks}`,
        this.#internals.addLimitAndOffset(options),
        ')',
      ]);
    }

    return joinSQLFragments([
      `DELETE FROM ${this.quoteTable(tableName)}`,
      options.where ? this.whereQuery(options.where, whereOptions) : '',
      this.#internals.addLimitAndOffset(options),
    ]);
  }

  bulkInsertQuery(
    tableName: TableNameOrModel,
    values: Array<Record<string, unknown>>,
    options?: BulkInsertQueryOptions,
    attributeHash?: Record<string, AttributeOptions>,
  ): string {
    if (options) {
      const BULK_INSERT_QUERY_SUPPORTED_OPTIONS = new Set<keyof BulkInsertQueryOptions>();

      if (this.dialect.supports.insert.ignore) {
        BULK_INSERT_QUERY_SUPPORTED_OPTIONS.add('ignoreDuplicates');
      }

      if (this.dialect.supports.insert.onConflict) {
        BULK_INSERT_QUERY_SUPPORTED_OPTIONS.add('conflictWhere');
        BULK_INSERT_QUERY_SUPPORTED_OPTIONS.add('ignoreDuplicates');
        BULK_INSERT_QUERY_SUPPORTED_OPTIONS.add('updateOnDuplicate');
      }

      if (this.dialect.supports.insert.returning) {
        BULK_INSERT_QUERY_SUPPORTED_OPTIONS.add('returning');
      }

      if (this.dialect.supports.insert.updateOnDuplicate) {
        BULK_INSERT_QUERY_SUPPORTED_OPTIONS.add('updateOnDuplicate');
      }

      rejectInvalidOptions(
        'bulkInsertQuery',
        this.dialect.name,
        BULK_INSERT_QUERY_SUPPORTABLE_OPTIONS,
        BULK_INSERT_QUERY_SUPPORTED_OPTIONS,
        options,
      );

      if (options.ignoreDuplicates && options.updateOnDuplicate) {
        throw new Error('Options ignoreDuplicates and updateOnDuplicate cannot be used together');
      }
    }

    if (!Array.isArray(values)) {
      throw new Error(`Invalid values: ${NodeUtil.inspect(values)}. Expected an array.`);
    }

    if (values.length === 0) {
      throw new Error('Invalid values: []. Expected at least one element.');
    }

    const model = isModelStatic(tableName) ? tableName : options?.model;
    const allColumns = new Set<string>();
    const valueHashes = removeNullishValuesFromArray(values, this.options.omitNull ?? false);
    const attributeMap = new Map<string, AttributeOptions>();
    const bulkInsertOptions = { ...options, model };

    if (model) {
      for (const [column, attribute] of model.modelDefinition.physicalAttributes.entries()) {
        attributeMap.set(attribute?.columnName ?? column, attribute);
      }
    } else if (attributeHash) {
      for (const [column, attribute] of Object.entries(attributeHash)) {
        attributeMap.set(attribute?.columnName ?? column, attribute);
      }
    }

    for (const row of valueHashes) {
      for (const column of Object.keys(row)) {
        allColumns.add(column);
      }
    }

    if (allColumns.size === 0) {
      throw new Error('No columns were defined');
    }

    const columnFragment = [...allColumns].map(column => this.quoteIdentifier(column)).join(',');
    const rowsFragment = valueHashes.map(row => {
      if (typeof row !== 'object' || row == null || Array.isArray(row)) {
        throw new Error(`Invalid row: ${NodeUtil.inspect(row)}. Expected an object.`);
      }

      const valueMap = new Map<string, string>();
      for (const column of allColumns) {
        const rowValue = row[column];
        if (attributeMap.get(column)?.autoIncrement && rowValue == null && this.dialect.supports.insert.default) {
          valueMap.set(column, 'DEFAULT');
        } else if (rowValue === undefined) {
          // Treat undefined values as DEFAULT (where supported) or NULL (where not supported)
          valueMap.set(column, this.dialect.supports.insert.default ? 'DEFAULT' : 'NULL');
        } else {
          valueMap.set(column, this.escape(rowValue, {
            ...bulkInsertOptions,
            type: attributeMap.get(column)?.type,
          }));
        }
      }

      return `(${[...valueMap.values()].join(',')})`;
    });

    const conflictFragment = bulkInsertOptions.updateOnDuplicate ? this.#internals.generateUpdateOnDuplicateKeysFragment(bulkInsertOptions) : '';
    const returningFragment = bulkInsertOptions.returning ? joinSQLFragments(['RETURNING', this.#internals.getReturnFields(bulkInsertOptions, attributeMap).join(', ')]) : '';

    return joinSQLFragments([
      'INSERT',
      bulkInsertOptions.ignoreDuplicates && this.dialect.supports.insert.ignore ? 'IGNORE' : '',
      'INTO',
      this.quoteTable(tableName),
      `(${columnFragment})`,
      'VALUES',
      rowsFragment.join(','),
      conflictFragment,
      bulkInsertOptions.ignoreDuplicates && this.dialect.supports.insert.onConflict ? 'ON CONFLICT DO NOTHING' : '',
      returningFragment,
    ]);
  }

  insertQuery(
    tableName: TableNameOrModel,
    value: Record<string, unknown>,
    options?: InsertQueryOptions,
    attributeHash?: Record<string, AttributeOptions>,
  ): QueryWithBindParams {
    if (options) {
      const INSERT_QUERY_SUPPORTED_OPTIONS = new Set<keyof InsertQueryOptions>();

      if (this.dialect.supports.insert.exception) {
        INSERT_QUERY_SUPPORTED_OPTIONS.add('exception');
      }

      if (this.dialect.supports.insert.ignore) {
        INSERT_QUERY_SUPPORTED_OPTIONS.add('ignoreDuplicates');
      }

      if (this.dialect.supports.insert.onConflict) {
        INSERT_QUERY_SUPPORTED_OPTIONS.add('conflictWhere');
        INSERT_QUERY_SUPPORTED_OPTIONS.add('ignoreDuplicates');
        INSERT_QUERY_SUPPORTED_OPTIONS.add('updateOnDuplicate');
      }

      if (this.dialect.supports.insert.returning) {
        INSERT_QUERY_SUPPORTED_OPTIONS.add('returning');
      }

      if (this.dialect.supports.insert.updateOnDuplicate) {
        INSERT_QUERY_SUPPORTED_OPTIONS.add('updateOnDuplicate');
      }

      rejectInvalidOptions(
        'insertQuery',
        this.dialect.name,
        INSERT_QUERY_SUPPORTABLE_OPTIONS,
        INSERT_QUERY_SUPPORTED_OPTIONS,
        options,
      );

      if (options.ignoreDuplicates && options.updateOnDuplicate) {
        throw new Error('Options ignoreDuplicates and updateOnDuplicate cannot be used together');
      }
    }

    if (typeof value !== 'object' || value == null || Array.isArray(value)) {
      throw new Error(`Invalid value: ${NodeUtil.inspect(value)}. Expected an object.`);
    }

    const bind = Object.create(null);
    const model = isModelStatic(tableName) ? tableName : options?.model;
    const valueMap = new Map<string, string>();
    const valueHash = removeNullishValuesFromHash(value, this.options.omitNull ?? false);
    const attributeMap = new Map<string, AttributeOptions>();
    const insertOptions: InsertQueryOptions = {
      ...options,
      model,
      bindParam: options?.bindParam === undefined ? this.#internals.bindParam(bind) : options.bindParam,
    };

    if (model) {
      for (const [column, attribute] of model.modelDefinition.physicalAttributes.entries()) {
        attributeMap.set(attribute?.columnName ?? column, attribute);
      }
    } else if (attributeHash) {
      for (const [column, attribute] of Object.entries(attributeHash)) {
        attributeMap.set(attribute?.columnName ?? column, attribute);
      }
    }

    for (const [column, rowValue] of Object.entries(valueHash)) {
      if (attributeMap.get(column)?.autoIncrement && rowValue == null && this.dialect.supports.insert.default) {
        valueMap.set(column, 'DEFAULT');
      } else if (rowValue === undefined) {
        // Treat undefined values as non-existent
        continue;
      } else {
        valueMap.set(column, this.escape(rowValue, {
          ...insertOptions,
          type: attributeMap.get(column)?.type,
        }));
      }
    }

    const returningFragment = insertOptions.returning ? joinSQLFragments(['RETURNING', this.#internals.getReturnFields(insertOptions, attributeMap).join(', ')]) : '';

    if (valueMap.size === 0) {
      return {
        query: joinSQLFragments([
          'INSERT INTO',
          this.quoteTable(tableName),
          this.dialect.supports.insert.defaultValues ? 'DEFAULT VALUES' : 'VALUES ()',
          returningFragment,
        ]),
        bind: typeof insertOptions.bindParam === 'function' ? bind : undefined,
      };
    }

    const rowFragment = [...valueMap.values()].join(',');
    const columnFragment = [...valueMap.keys()].map(column => this.quoteIdentifier(column)).join(',');
    const conflictFragment = insertOptions.updateOnDuplicate ? this.#internals.generateUpdateOnDuplicateKeysFragment(insertOptions, valueMap) : '';

    return {
      query: joinSQLFragments([
        'INSERT',
        insertOptions.ignoreDuplicates && this.dialect.supports.insert.ignore ? 'IGNORE' : '',
        'INTO',
        this.quoteTable(tableName),
        `(${columnFragment})`,
        'VALUES',
        `(${rowFragment})`,
        conflictFragment,
        insertOptions.ignoreDuplicates && this.dialect.supports.insert.onConflict ? 'ON CONFLICT DO NOTHING' : '',
        returningFragment,
      ]),
      bind: typeof insertOptions.bindParam === 'function' ? bind : undefined,
    };
  }

  __TEST__getInternals() {
    if (process.env.npm_lifecycle_event !== 'mocha') {
      throw new Error('You can only access the internals of the query generator in test mode.');
    }

    return this.#internals;
  }
}
