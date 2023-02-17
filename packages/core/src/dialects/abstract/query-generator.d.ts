// TODO: complete me - this file is a stub that will be completed when query-generator.ts is migrated to TS

import type {
  NormalizedAttributeOptions,
  FindOptions,
  Model,
  AttributeOptions,
  ModelStatic,
  SearchPathable,
  WhereOptions,
} from '../../model.js';
import type { QueryTypes } from '../../query-types.js';
import type { Literal, SequelizeMethod, Col } from '../../utils/sequelize-method.js';
import type { DataType } from './data-types.js';
import type { QueryGeneratorOptions } from './query-generator-typescript.js';
import { AbstractQueryGeneratorTypeScript } from './query-generator-typescript.js';
import type { QueryWithBindParams } from './query-generator.types.js';
import type { TableName } from './query-interface.js';

type ParameterOptions = {
  // only named replacements are allowed
  replacements?: { [key: string]: unknown },
};

type EscapeOptions = ParameterOptions & {
  /**
   * Set to true if the value to escape is in a list (e.g. used inside of Op.any or Op.all).
   */
  isList?: boolean,
};

type SelectOptions<M extends Model> = FindOptions<M> & {
  model: ModelStatic<M>,
};

type InsertOptions = ParameterOptions & SearchPathable & {
  exception?: boolean,
  bindParam?: false | ((value: unknown) => string),

  updateOnDuplicate?: string[],
  ignoreDuplicates?: boolean,
  upsertKeys?: string[],
  returning?: boolean | Array<string | Literal | Col>,
};

type BulkInsertOptions = ParameterOptions & {
  hasTrigger?: boolean,

  updateOnDuplicate?: string[],
  ignoreDuplicates?: boolean,
  upsertKeys?: string[],
  returning?: boolean | Array<string | Literal | Col>,
};

type UpdateOptions = ParameterOptions & {
  bindParam?: false | ((value: unknown) => string),
};

type DeleteOptions = ParameterOptions & {
  limit?: number | Literal | null | undefined,
};

type ArithmeticQueryOptions = ParameterOptions & {
  returning?: boolean | Array<string | Literal | Col>,
};

export type WhereItemsQueryOptions = ParameterOptions & {
  model?: ModelStatic,
  type?: QueryTypes,
  prefix?: string | Literal,
  field?: AttributeOptions,
};

type HandleSequelizeMethodOptions = ParameterOptions & {

};

// keep CREATE_DATABASE_QUERY_SUPPORTABLE_OPTIONS updated when modifying this
export interface CreateDatabaseQueryOptions {
  collate?: string;
  charset?: string;
  encoding?: string;
  ctype?: string;
  template?: string;
}

// keep CREATE_SCHEMA_QUERY_SUPPORTABLE_OPTIONS updated when modifying this
export interface CreateSchemaQueryOptions {
  collate?: string;
  charset?: string;
}

// keep DROP_TABLE_QUERY_SUPPORTABLE_OPTIONS updated when modifying this
export interface DropTableQueryOptions {
  cascade?: boolean;
}

// keep LIST_SCHEMAS_QUERY_SUPPORTABLE_OPTIONS updated when modifying this
export interface ListSchemasQueryOptions {
  /** List of schemas to exclude from output */
  skip?: string[];
}

// keep ADD_COLUMN_QUERY_SUPPORTABLE_OPTIONS updated when modifying this
export interface AddColumnQueryOptions {
  ifNotExists?: boolean;
}

// keep REMOVE_COLUMN_QUERY_SUPPORTABLE_OPTIONS updated when modifying this
export interface RemoveColumnQueryOptions {
  ifExists?: boolean;
}

/**
 * The base class for all query generators, used to generate all SQL queries.
 *
 * The implementation varies between SQL dialects, and is overridden by subclasses. You can access your dialect's version
 * through {@link Sequelize#queryGenerator}.
 */
export class AbstractQueryGenerator extends AbstractQueryGeneratorTypeScript {
  constructor(options: QueryGeneratorOptions);

  setImmediateQuery(constraints: string[]): string;
  setDeferredQuery(constraints: string[]): string;
  generateTransactionId(): string;
  whereQuery(where: object, options?: ParameterOptions): string;
  whereItemsQuery(where: WhereOptions, options: WhereItemsQueryOptions, binding?: string): string;
  validate(value: unknown, field?: NormalizedAttributeOptions): void;
  escape(value: unknown, field?: NormalizedAttributeOptions, options?: EscapeOptions): string;
  quoteIdentifiers(identifiers: string): string;
  handleSequelizeMethod(
    smth: SequelizeMethod,
    tableName?: TableName,
    factory?: ModelStatic,
    options?: HandleSequelizeMethodOptions,
    prepend?: boolean,
  ): string;

  /**
   * Generates an SQL query that extract JSON property of given path.
   *
   * @param   {string}               column   The JSON column
   * @param   {string|Array<string>} [path]   The path to extract (optional)
   * @param   {boolean}              [isJson] The value is JSON use alt symbols (optional)
   * @returns {string}                        The generated sql query
   * @private
   */
  // TODO: see how we can make the typings protected/private while still allowing it to be typed in tests
  jsonPathExtractionQuery(column: string, path?: string | string[], isJson?: boolean): string;

  selectQuery<M extends Model>(tableName: string, options?: SelectOptions<M>, model?: ModelStatic<M>): string;
  insertQuery(
    table: TableName,
    valueHash: object,
    columnDefinitions?: { [columnName: string]: NormalizedAttributeOptions },
    options?: InsertOptions
  ): { query: string, bind?: unknown[] };
  bulkInsertQuery(
    tableName: TableName,
    newEntries: object[],
    options?: BulkInsertOptions,
    columnDefinitions?: { [columnName: string]: NormalizedAttributeOptions }
  ): string;

  addColumnQuery(
    table: TableName,
    columnName: string,
    columnDefinition: AttributeOptions | DataType,
    options?: AddColumnQueryOptions,
  ): string;

  removeColumnQuery(
    table: TableName,
    attributeName: string,
    options?: RemoveColumnQueryOptions,
  ): string;

  updateQuery(
    tableName: TableName,
    attrValueHash: object,
    where: WhereOptions,
    options?: UpdateOptions,
    columnDefinitions?: { [columnName: string]: NormalizedAttributeOptions },
  ): { query: string, bind?: unknown[] };

  deleteQuery(
    tableName: TableName,
    where?: WhereOptions,
    options?: DeleteOptions,
    model?: ModelStatic<Model>,
  ): string;

  arithmeticQuery(
    operator: string,
    tableName: TableName,
    where: WhereOptions,
    incrementAmountsByField: { [key: string]: number | Literal },
    extraAttributesToBeUpdated: { [key: string]: unknown },
    options?: ArithmeticQueryOptions,
  ): string;

  dropTableQuery(tableName: TableName, options?: DropTableQueryOptions): string;

  createSchemaQuery(schemaName: string, options?: CreateSchemaQueryOptions): string;
  dropSchemaQuery(schemaName: string): string | QueryWithBindParams;

  listSchemasQuery(options?: ListSchemasQueryOptions): string;

  createDatabaseQuery(databaseName: string, options?: CreateDatabaseQueryOptions): string;
  dropDatabaseQuery(databaseName: string): string;
  listDatabasesQuery(): string;

  /**
   * Creates a function that can be used to collect bind parameters.
   *
   * @param bind A mutable object to which bind parameters will be added.
   */
  bindParam(bind: Record<string, unknown>): (newBind: unknown) => string;
}
