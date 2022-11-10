import type { Deferrable } from '../../deferrable';
import type {
  Logging,
  Model,
  ModelAttributeColumnOptions,
  ModelAttributes,
  WhereOptions,
  Filterable,
  ModelStatic,
  CreationAttributes,
  Attributes,
  BuiltModelAttributeColumnOptions,
} from '../../model';
import type { Sequelize, QueryRawOptions, QueryRawOptionsWithModel } from '../../sequelize';
import type { Transaction } from '../../transaction';
import type { Fn, Literal } from '../../utils';
import type { SetRequired } from '../../utils/set-required';
import type { DataType } from './data-types.js';
import type { AbstractQueryGenerator, AddColumnQueryOptions, RemoveColumnQueryOptions } from './query-generator.js';

interface Replaceable {
  /**
   * Only named replacements are allowed in query interface methods.
   */
  replacements?: { [key: string]: unknown };
}

interface QiOptionsWithReplacements extends QueryRawOptions, Replaceable {}

export interface QiInsertOptions extends QueryRawOptions, Replaceable {
  returning?: boolean | string[];
}

export interface QiSelectOptions extends QueryRawOptions, Replaceable, Filterable<any> {

}

export interface QiUpdateOptions extends QueryRawOptions, Replaceable {
  returning?: boolean | string[];
}

export interface QiDeleteOptions extends QueryRawOptions, Replaceable {
  limit?: number | Literal | null | undefined;
}

export interface QiArithmeticOptions extends QueryRawOptions, Replaceable {
  returning?: boolean | string[];
}

export interface QiUpsertOptions<M extends Model> extends QueryRawOptionsWithModel<M>, Replaceable {

}

export interface CreateFunctionOptions extends QueryRawOptions {
  force?: boolean;
}

export interface CollateCharsetOptions {
  collate?: string;
  charset?: string;
}

export interface QueryInterfaceCreateTableOptions extends QueryRawOptions, CollateCharsetOptions {
  engine?: string;
  /**
   * Used for compound unique keys.
   */
  uniqueKeys?: {
    [keyName: string]: {
      fields: string[],
      customIndex?: boolean,
    },
  };
}

export interface QueryInterfaceDropTableOptions extends QueryRawOptions {
  cascade?: boolean;
  force?: boolean;
}

export interface QueryInterfaceDropAllTablesOptions extends QueryRawOptions {
  skip?: string[];
}

export interface TableNameWithSchema {
  tableName: string;
  schema?: string;
  delimiter?: string;
  as?: string;
  name?: string;
}
export type TableName = string | TableNameWithSchema;

export type IndexType = 'UNIQUE' | 'FULLTEXT' | 'SPATIAL';
export type IndexMethod = 'BTREE' | 'HASH' | 'GIST' | 'SPGIST' | 'GIN' | 'BRIN' | string;

export interface IndexField {
  /**
   * The name of the column
   */
  name: string;

  /**
   * Create a prefix index of length chars
   */
  length?: number;

  /**
   * The direction the column should be sorted in
   */
  order?: 'ASC' | 'DESC';

  /**
   * The collation (sort order) for the column
   */
  collate?: string;

  /**
   * Index operator type. Postgres only
   */
  operator?: string;
}

export interface IndexOptions {
  /**
   * The name of the index. Defaults to model name + _ + fields concatenated
   */
  name?: string;

  /** For FULLTEXT columns set your parser */
  parser?: string | null;

  /**
   * Index type. Only used by mysql. One of `UNIQUE`, `FULLTEXT` and `SPATIAL`
   */
  type?: IndexType;

  /**
   * Should the index by unique? Can also be triggered by setting type to `UNIQUE`
   *
   * @default false
   */
  unique?: boolean;

  /**
   * PostgreSQL will build the index without taking any write locks. Postgres only.
   *
   * @default false
   */
  concurrently?: boolean;

  /**
   * The fields to index.
   */
  fields?: Array<string | IndexField | Fn | Literal>;

  /**
   * The method to create the index by (`USING` statement in SQL).
   * BTREE and HASH are supported by mysql and postgres.
   * Postgres additionally supports GIST, SPGIST, BRIN and GIN.
   */
  using?: IndexMethod;

  /**
   * Index operator type. Postgres only
   */
  operator?: string;

  /**
   * Optional where parameter for index. Can be used to limit the index to certain rows.
   */
  where?: WhereOptions<any>;

  /**
   * Prefix to append to the index name.
   */
  prefix?: string;
}

export interface QueryInterfaceIndexOptions extends IndexOptions, Omit<QiOptionsWithReplacements, 'type'> {}

export interface BaseConstraintOptions {
  name?: string;
  fields: string[];
}

export interface AddUniqueConstraintOptions extends BaseConstraintOptions {
  type: 'unique';
  deferrable?: Deferrable;
}

export interface AddDefaultConstraintOptions extends BaseConstraintOptions {
  type: 'default';
  defaultValue?: unknown;
}

export interface AddCheckConstraintOptions extends BaseConstraintOptions {
  type: 'check';
  where?: WhereOptions<any>;
}

export interface AddPrimaryKeyConstraintOptions extends BaseConstraintOptions {
  type: 'primary key';
  deferrable?: Deferrable;
}

export interface AddForeignKeyConstraintOptions extends BaseConstraintOptions {
  type: 'foreign key';
  references?: {
    table: TableName,
    field: string,
  };
  onDelete: string;
  onUpdate: string;
  deferrable?: Deferrable;
}

export type AddConstraintOptions =
| AddUniqueConstraintOptions
| AddDefaultConstraintOptions
| AddCheckConstraintOptions
| AddPrimaryKeyConstraintOptions
| AddForeignKeyConstraintOptions;

export interface CreateDatabaseOptions extends CollateCharsetOptions, QueryRawOptions {
  encoding?: string;
}

export interface FunctionParam {
  type: string;
  name?: string;
  direction?: string;
}

export interface ColumnDescription {
  type: string;
  allowNull: boolean;
  defaultValue: string;
  primaryKey: boolean;
  autoIncrement: boolean;
  comment: string | null;
}

export interface ColumnsDescription {
  [key: string]: ColumnDescription;
}

export interface DatabaseDescription {
  name: string;
}

export interface AddColumnOptions extends AddColumnQueryOptions, QueryRawOptions, Replaceable {}

export interface RemoveColumnOptions extends RemoveColumnQueryOptions, QueryRawOptions, Replaceable {}

/**
* The interface that Sequelize uses to talk to all databases.
*
* This interface is available through sequelize.queryInterface. It should not be commonly used, but it's
* referenced anyway, so it can be used.
*/
export class QueryInterface {
  /**
   * Returns the dialect-specific sql generator.
   *
   * We don't have a definition for the QueryGenerator, because I doubt it is commonly in use separately.
   */
  queryGenerator: AbstractQueryGenerator;

  /**
   * Returns the current sequelize instance.
   */
  sequelize: Sequelize;

  constructor(sequelize: Sequelize, queryGenerator: AbstractQueryGenerator);

  /**
   * Queries the schema (table list).
   *
   * @param schema The schema to query. Applies only to Postgres.
   */
  createSchema(schema?: string, options?: QueryRawOptions): Promise<void>;

  /**
   * Drops the specified schema (table).
   *
   * @param schema The schema to query. Applies only to Postgres.
   */
  dropSchema(schema?: string, options?: QueryRawOptions): Promise<void>;

  /**
   * Drops all tables.
   */
  dropAllSchemas(options?: QueryInterfaceDropAllTablesOptions): Promise<void>;

  /**
   * Queries all table names in the database.
   *
   * @param options
   */
  showAllSchemas(options?: QueryRawOptions): Promise<object>;

  /**
   * Return database version
   */
  databaseVersion(options?: QueryRawOptions): Promise<string>;

  /**
   * Creates a table with specified attributes.
   *
   * @param tableName     Name of table to create
   * @param attributes    Hash of attributes, key is attribute name, value is data type
   * @param options       Table options.
   */
  createTable<M extends Model>(
    tableName: TableName,
    attributes: ModelAttributes<M, CreationAttributes<M>>,
    options?: QueryInterfaceCreateTableOptions
  ): Promise<void>;

  /**
   * Drops the specified table.
   *
   * @param tableName Table name.
   * @param options   Query options, particularly "force".
   */
  dropTable(tableName: TableName, options?: QueryInterfaceDropTableOptions): Promise<void>;

  /**
   * Drops all tables.
   *
   * @param options
   */
  dropAllTables(options?: QueryInterfaceDropAllTablesOptions): Promise<void>;

  /**
   * Drops all defined enums
   *
   * @param options
   */
  dropAllEnums(options?: QueryRawOptions): Promise<void>;

  /**
   * Renames a table
   */
  renameTable(before: TableName, after: TableName, options?: QueryRawOptions): Promise<void>;

  /**
   * Returns all tables
   */
  showAllTables(options?: QueryRawOptions): Promise<string[]>;

  /**
   * Returns a promise that resolves to true if the table exists in the database, false otherwise.
   *
   * @param tableName The name of the table
   * @param options Options passed to {@link Sequelize#query}
   */
  tableExists(tableName: TableName, options?: QueryRawOptions): Promise<boolean>;

  /**
   * Describe a table
   */
  describeTable(
    tableName: TableName,
    options?: string | { schema?: string, schemaDelimiter?: string } & Logging
  ): Promise<ColumnsDescription>;

  /**
   * Adds a new column to a table
   */
  addColumn(
    table: TableName,
    key: string,
    attribute: ModelAttributeColumnOptions | DataType,
    options?: AddColumnOptions
  ): Promise<void>;

  /**
   * Removes a column from a table
   */
  removeColumn(
    table: TableName,
    attribute: string,
    options?: RemoveColumnOptions,
  ): Promise<void>;

  /**
   * Changes a column
   */
  changeColumn(
    tableName: TableName,
    attributeName: string,
    dataTypeOrOptions?: DataType | ModelAttributeColumnOptions,
    options?: QiOptionsWithReplacements
  ): Promise<void>;

  /**
   * Renames a column
   */
  renameColumn(
    tableName: TableName,
    attrNameBefore: string,
    attrNameAfter: string,
    options?: QiOptionsWithReplacements
  ): Promise<void>;

  /**
   * Adds a new index to a table
   */
  addIndex(
    tableName: TableName,
    attributes: string[],
    options?: QueryInterfaceIndexOptions,
    rawTablename?: string
  ): Promise<void>;
  addIndex(
    tableName: TableName,
    options: SetRequired<QueryInterfaceIndexOptions, 'fields'>,
    rawTablename?: string
  ): Promise<void>;

  /**
   * Removes an index of a table
   */
  removeIndex(tableName: TableName, indexName: string, options?: QueryInterfaceIndexOptions): Promise<void>;
  removeIndex(tableName: TableName, attributes: string[], options?: QueryInterfaceIndexOptions): Promise<void>;

  /**
   * Adds constraints to a table
   */
  addConstraint(
    tableName: TableName,
    options?: AddConstraintOptions & QueryRawOptions
  ): Promise<void>;

  /**
   * Removes constraints from a table
   */
  removeConstraint(tableName: TableName, constraintName: string, options?: QueryRawOptions): Promise<void>;

  /**
   * Shows the index of a table
   */
  showIndex(tableName: string | object, options?: QueryRawOptions): Promise<object>;

  /**
   * Put a name to an index
   */
  nameIndexes(indexes: string[], rawTablename: string): Promise<void>;

  /**
   * Returns all foreign key constraints of requested tables
   */
  getForeignKeysForTables(tableNames: string[], options?: QueryRawOptions): Promise<object>;

  /**
   * Get foreign key references details for the table
   */
  getForeignKeyReferencesForTable(tableName: TableName, options?: QueryRawOptions): Promise<object>;

  /**
   * Inserts a new record
   */
  insert(instance: Model | null, tableName: string, values: object, options?: QiInsertOptions): Promise<object>;

  /**
   * Inserts or Updates a record in the database
   */
  upsert<M extends Model>(
    tableName: TableName,
    insertValues: object,
    updateValues: object,
    where: object,
    options?: QiUpsertOptions<M>,
  ): Promise<object>;

  /**
   * Inserts multiple records at once
   */
  bulkInsert(
    tableName: TableName,
    records: object[],
    options?: QiOptionsWithReplacements,
    attributes?: Record<string, ModelAttributeColumnOptions>
  ): Promise<object | number>;

  /**
   * Updates a row
   */
  update<M extends Model>(
    instance: M,
    tableName: TableName,
    values: object,
    where: WhereOptions<Attributes<M>>,
    options?: QiUpdateOptions
  ): Promise<object>;

  /**
   * Updates multiple rows at once
   */
  bulkUpdate(
    tableName: TableName,
    values: object,
    where: WhereOptions<any>,
    options?: QiOptionsWithReplacements,
    columnDefinitions?: { [columnName: string]: BuiltModelAttributeColumnOptions },
  ): Promise<object>;

  /**
   * Deletes a row
   */
  delete(
    instance: Model | null,
    tableName: TableName,
    identifier: WhereOptions<any>,
    options?: QiDeleteOptions,
  ): Promise<object>;

  /**
   * Deletes multiple rows at once
   */
  bulkDelete(
    tableName: TableName,
    identifier: WhereOptions<any>,
    options?: QiOptionsWithReplacements,
    model?: ModelStatic
  ): Promise<object>;

  /**
   * Returns selected rows
   */
  select(model: ModelStatic | null, tableName: TableName, options?: QiSelectOptions): Promise<object[]>;

  /**
   * Increments a row value
   */
  increment<M extends Model>(
    model: ModelStatic<M>,
    tableName: TableName,
    incrementAmountsByField: object,
    extraAttributesToBeUpdated?: object,
    where?: WhereOptions<Attributes<M>>,
    options?: QiArithmeticOptions,
  ): Promise<object>;

  /**
   * Decrements a row value
   */
  decrement<M extends Model>(
    model: ModelStatic<M>,
    tableName: TableName,
    incrementAmountsByField: object,
    extraAttributesToBeUpdated?: object,
    where?: WhereOptions<Attributes<M>>,
    options?: QiArithmeticOptions,
  ): Promise<object>;

  /**
   * Selects raw without parsing the string into an object
   */
  rawSelect(
    tableName: TableName,
    options: QiSelectOptions,
    attributeSelector: string,
    model?: ModelStatic
  ): Promise<string[]>;

  /**
   * Postgres only. Creates a trigger on specified table to call the specified function with supplied
   * parameters.
   */
  createTrigger(
    tableName: TableName,
    triggerName: string,
    timingType: string,
    fireOnArray: Array<{
      [key: string]: unknown,
    }>,
    functionName: string,
    functionParams: FunctionParam[],
    optionsArray: string[],
    options?: QiOptionsWithReplacements
  ): Promise<void>;

  /**
   * Postgres only. Drops the specified trigger.
   */
  dropTrigger(tableName: TableName, triggerName: string, options?: QiOptionsWithReplacements): Promise<void>;

  /**
   * Postgres only. Renames a trigger
   */
  renameTrigger(
    tableName: TableName,
    oldTriggerName: string,
    newTriggerName: string,
    options?: QiOptionsWithReplacements
  ): Promise<void>;

  /**
   * Postgres only. Create a function
   */
  createFunction(
    functionName: string,
    params: FunctionParam[],
    returnType: string,
    language: string,
    body: string,
    optionsArray?: string[],
    options?: CreateFunctionOptions
  ): Promise<void>;

  /**
   * Postgres only. Drops a function
   */
  dropFunction(functionName: string, params: FunctionParam[], options?: QiOptionsWithReplacements): Promise<void>;

  /**
   * Postgres only. Rename a function
   */
  renameFunction(
    oldFunctionName: string,
    params: FunctionParam[],
    newFunctionName: string,
    options?: QiOptionsWithReplacements
  ): Promise<void>;

  /**
   * Escape an identifier (e.g. a table or attribute name). If force is true, the identifier will be quoted
   * even if the `quoteIdentifiers` option is false.
   */
  quoteIdentifier(identifier: string, force?: boolean): string;

  /**
   * Split an identifier into .-separated tokens and quote each part.
   */
  quoteIdentifiers(identifiers: string): string;

  /**
   * Set option for autocommit of a transaction
   */
  setAutocommit(transaction: Transaction, value: boolean, options?: QueryRawOptions): Promise<void>;

  /**
   * Set the isolation level of a transaction
   */
  setIsolationLevel(transaction: Transaction, value: string, options?: QueryRawOptions): Promise<void>;

  /**
   * Begin a new transaction
   */
  startTransaction(transaction: Transaction, options?: QueryRawOptions): Promise<void>;

  /**
   * Defer constraints
   */
  deferConstraints(transaction: Transaction, options?: QueryRawOptions): Promise<void>;

  /**
   * Commit an already started transaction
   */
  commitTransaction(transaction: Transaction, options?: QueryRawOptions): Promise<void>;

  /**
   * Rollback ( revert ) a transaction that has'nt been commited
   */
  rollbackTransaction(transaction: Transaction, options?: QueryRawOptions): Promise<void>;

  /**
   * Creates a database
   */
  createDatabase(name: string, options?: CreateDatabaseOptions): Promise<void>;

  /**
   * Creates a database
   */
  dropDatabase(name: string, options?: QueryRawOptions): Promise<void>;

  /**
   * Lists all available databases
   */
  listDatabases(options?: QueryRawOptions): Promise<DatabaseDescription[]>;
}
