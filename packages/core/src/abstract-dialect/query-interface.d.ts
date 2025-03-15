import type { Col } from '../expression-builders/col.js';
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
import type { DataType } from './data-types.js';
import type { AbstractDialect } from './dialect.js';
import type { AddLimitOffsetOptions } from './query-generator.internal-types.js';
import type { AddColumnQueryOptions } from './query-generator.js';
import type { TableOrModel } from './query-generator.types.js';
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

export interface FunctionParam {
  type: string;
  name?: string;
  direction?: string;
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
