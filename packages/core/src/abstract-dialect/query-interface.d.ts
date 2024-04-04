import type { SetRequired } from 'type-fest';
import type { Col } from '../expression-builders/col.js';
import type { Fn } from '../expression-builders/fn.js';
import type { Literal } from '../expression-builders/literal.js';
import type {
  AttributeOptions,
  Attributes,
  CreationAttributes,
  Filterable,
  Model,
  ModelStatic,
  NormalizedAttributeOptions,
} from '../model';
import type { QueryRawOptions, QueryRawOptionsWithModel } from '../sequelize';
import type { AllowLowercase } from '../utils/types.js';
import type { DataType } from './data-types.js';
import type { AbstractDialect } from './dialect.js';
import type { AddLimitOffsetOptions } from './query-generator.internal-types.js';
import type { AddColumnQueryOptions } from './query-generator.js';
import type { RemoveIndexQueryOptions, TableOrModel } from './query-generator.types.js';
import { AbstractQueryInterfaceTypeScript } from './query-interface-typescript';
import type { ColumnsDescription } from './query-interface.types.js';
import type { WhereOptions } from './where-sql-builder-types.js';

interface Replaceable {
  /**
   * Only named replacements are allowed in query interface methods.
   */
  replacements?: { [key: string]: unknown };
}

interface QiOptionsWithReplacements extends QueryRawOptions, Replaceable {}

export interface QiInsertOptions extends QueryRawOptions, Replaceable {
  returning?: boolean | Array<string | Literal | Col>;
}

export interface QiSelectOptions extends QueryRawOptions, Filterable<any>, AddLimitOffsetOptions {
  minifyAliases?: boolean;
}

export interface QiUpdateOptions extends QueryRawOptions, Replaceable {
  returning?: boolean | Array<string | Literal | Col>;
}

export interface QiArithmeticOptions extends QueryRawOptions, Replaceable {
  returning?: boolean | Array<string | Literal | Col>;
}

export interface QiUpsertOptions<M extends Model>
  extends QueryRawOptionsWithModel<M>,
    Replaceable {}

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
  uniqueKeys?: { [indexName: string]: { fields: string[] } };
}

export interface TableNameWithSchema {
  tableName: string;
  schema?: string;
  delimiter?: string;
}

export type TableName = string | TableNameWithSchema;

export type IndexType = AllowLowercase<'UNIQUE' | 'FULLTEXT' | 'SPATIAL'>;
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
  type?: IndexType | undefined;

  /**
   * Should the index by unique? Can also be triggered by setting type to `UNIQUE`
   *
   * @default false
   */
  unique?: boolean;

  /**
   * The message to display if the unique constraint is violated.
   */
  msg?: string;

  /**
   * PostgreSQL will build the index without taking any write locks. Postgres only.
   *
   * @default false
   */
  concurrently?: boolean;

  /**
   * The fields to index.
   */
  // TODO: rename to "columns"
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
  where?: WhereOptions;

  /**
   * Prefix to append to the index name.
   */
  prefix?: string;

  /**
   * Non-key columns to be added to the lead level of the nonclustered index.
   */
  include?: Literal | Array<string | Literal>;
}

export interface QueryInterfaceIndexOptions
  extends IndexOptions,
    Omit<QiOptionsWithReplacements, 'type'> {}

export interface QueryInterfaceRemoveIndexOptions
  extends QueryInterfaceIndexOptions,
    RemoveIndexQueryOptions {}

export interface FunctionParam {
  type: string;
  name?: string;
  direction?: string;
}

export interface IndexFieldDescription {
  attribute: string;
  length: number | undefined;
  order: 'DESC' | 'ASC';
  collate: string | undefined;
}

export interface IndexDescription {
  primary: boolean;
  fields: IndexFieldDescription[];
  includes: string[] | undefined;
  name: string;
  tableName: string | undefined;
  unique: boolean;
  type: string | undefined;
}

export interface AddColumnOptions extends AddColumnQueryOptions, QueryRawOptions, Replaceable {}

export interface CreateTableAttributeOptions<M extends Model = Model> extends AttributeOptions<M> {
  /**
   * Apply unique constraint on a column
   */
  unique?: boolean;
}

/**
 * Interface for Attributes provided for all columns in a model
 */
export type CreateTableAttributes<M extends Model = Model, TAttributes = any> = {
  /**
   * The description of a database column
   */
  [name in keyof TAttributes]: DataType | CreateTableAttributeOptions<M>;
};

/**
 * This interface exposes low-level APIs to interact with the database.
 * Typically useful in contexts where models are not available, such as migrations.
 *
 * This interface is available through {@link Sequelize#queryInterface}.
 */
export class AbstractQueryInterface<
  Dialect extends AbstractDialect = AbstractDialect,
> extends AbstractQueryInterfaceTypeScript<Dialect> {
  /**
   * Creates a table with specified attributes.
   *
   * @param tableName     Name of table to create
   * @param attributes    Hash of attributes, key is attribute name, value is data type
   * @param options       Table options.
   */
  createTable<M extends Model>(
    tableName: TableName,
    attributes: CreateTableAttributes<M, CreationAttributes<M>>,
    options?: QueryInterfaceCreateTableOptions,
  ): Promise<void>;

  /**
   * Drops all defined enums
   *
   * @param options
   */
  dropAllEnums(options?: QueryRawOptions): Promise<void>;

  /**
   * Adds a new column to a table
   */
  addColumn(
    table: TableName,
    key: string,
    attribute: AttributeOptions | DataType,
    options?: AddColumnOptions,
  ): Promise<void>;

  /**
   * Changes a column
   */
  changeColumn(
    tableName: TableName,
    attributeName: string,
    dataTypeOrOptions?: DataType | AttributeOptions,
    options?: QiOptionsWithReplacements,
  ): Promise<void>;

  /**
   * Renames a column
   */
  renameColumn(
    tableName: TableName,
    attrNameBefore: string,
    attrNameAfter: string,
    options?: QiOptionsWithReplacements,
  ): Promise<void>;

  /**
   * Adds a new index to a table
   */
  addIndex(
    tableName: TableOrModel,
    attributes: string[],
    options?: QueryInterfaceIndexOptions,
    rawTablename?: string,
  ): Promise<void>;
  addIndex(
    tableName: TableOrModel,
    options: SetRequired<QueryInterfaceIndexOptions, 'fields'>,
    rawTablename?: string,
  ): Promise<void>;

  /**
   * Removes an index of a table
   */
  removeIndex(
    tableName: TableName,
    indexName: string,
    options?: QueryInterfaceRemoveIndexOptions,
  ): Promise<void>;
  removeIndex(
    tableName: TableName,
    attributes: string[],
    options?: QueryInterfaceRemoveIndexOptions,
  ): Promise<void>;

  /**
   * Shows the index of a table
   */
  showIndex(tableName: TableOrModel, options?: QueryRawOptions): Promise<IndexDescription[]>;

  /**
   * Put a name to an index
   */
  nameIndexes(indexes: string[], rawTablename: string): Promise<void>;

  /**
   * Inserts a new record
   */
  insert(
    instance: Model | null,
    tableName: TableName,
    values: object,
    options?: QiInsertOptions,
  ): Promise<object>;

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
    attributes?: Record<string, AttributeOptions>,
  ): Promise<object | number>;

  /**
   * Updates a row
   */
  update<M extends Model>(
    instance: M,
    tableName: TableName,
    values: object,
    where: WhereOptions<Attributes<M>>,
    options?: QiUpdateOptions,
  ): Promise<object>;

  /**
   * Updates multiple rows at once
   */
  bulkUpdate(
    tableName: TableName,
    values: object,
    where: WhereOptions<any>,
    options?: QiOptionsWithReplacements,
    columnDefinitions?: { [columnName: string]: NormalizedAttributeOptions },
  ): Promise<object>;

  /**
   * Returns selected rows
   */
  select(
    model: ModelStatic | null,
    tableName: TableName,
    options?: QiSelectOptions,
  ): Promise<object[]>;

  /**
   * Increments a row value
   */
  increment<M extends Model>(
    model: ModelStatic<M>,
    tableName: TableName,
    where: WhereOptions<Attributes<M>>,
    incrementAmountsByField: object,
    extraAttributesToBeUpdated: object,
    options?: QiArithmeticOptions,
  ): Promise<object>;

  /**
   * Decrements a row value
   */
  decrement<M extends Model>(
    model: ModelStatic<M>,
    tableName: TableName,
    where: WhereOptions<Attributes<M>>,
    decrementAmountsByField: object,
    extraAttributesToBeUpdated: object,
    options?: QiArithmeticOptions,
  ): Promise<object>;

  /**
   * Selects raw without parsing the string into an object
   */
  rawSelect(
    tableName: TableName,
    options: QiSelectOptions,
    attributeSelector: string,
    model?: ModelStatic,
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
      [key: string]: unknown;
    }>,
    functionName: string,
    functionParams: FunctionParam[],
    optionsArray: string[],
    options?: QiOptionsWithReplacements,
  ): Promise<void>;

  /**
   * Postgres only. Drops the specified trigger.
   */
  dropTrigger(
    tableName: TableName,
    triggerName: string,
    options?: QiOptionsWithReplacements,
  ): Promise<void>;

  /**
   * Postgres only. Renames a trigger
   */
  renameTrigger(
    tableName: TableName,
    oldTriggerName: string,
    newTriggerName: string,
    options?: QiOptionsWithReplacements,
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
    options?: CreateFunctionOptions,
  ): Promise<void>;

  /**
   * Postgres only. Drops a function
   */
  dropFunction(
    functionName: string,
    params: FunctionParam[],
    options?: QiOptionsWithReplacements,
  ): Promise<void>;

  /**
   * Postgres only. Rename a function
   */
  renameFunction(
    oldFunctionName: string,
    params: FunctionParam[],
    newFunctionName: string,
    options?: QiOptionsWithReplacements,
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

  // TODO: rename to "describeColumn"
  assertTableHasColumn(
    tableName: TableOrModel,
    columnName: string,
    options?: QueryRawOptions,
  ): Promise<ColumnsDescription>;
}
