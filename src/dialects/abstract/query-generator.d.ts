// TODO: complete me - this file is a stub that will be completed when query-generator.ts is migrated to TS

import type {
  BuiltModelAttributeColumOptions,
  FindOptions,
  Model,
  ModelAttributeColumnOptions,
  ModelStatic,
  SearchPathable,
  WhereOptions,
} from '../../model.js';
import type { QueryTypes } from '../../query-types.js';
import type { Literal, SequelizeMethod } from '../../utils/index.js';
import type { TableName } from './query-interface.js';
import type { AbstractDialect } from './index.js';

type ParameterOptions = {
  // only named replacements are allowed
  replacements?: { [key: string]: unknown },
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
  returning?: boolean | string[],
};

type BulkInsertOptions = ParameterOptions & {
  hasTrigger?: boolean,

  updateOnDuplicate?: string[],
  ignoreDuplicates?: boolean,
  upsertKeys?: string[],
  returning?: boolean | string[],
};

type UpdateOptions = ParameterOptions & {
  bindParam?: false | ((value: unknown) => string),
};

type DeleteOptions = ParameterOptions & {
  limit?: number | Literal | null | undefined,
};

type ArithmeticQueryOptions = ParameterOptions & {
  returning?: boolean | string[],
};

export type WhereItemsQueryOptions = ParameterOptions & {
  model?: ModelStatic,
  type?: QueryTypes,
  prefix?: string | Literal,
  field?: ModelAttributeColumnOptions,
};

type HandleSequelizeMethodOptions = ParameterOptions & {

};

// keep CREATE_DATABASE_QUERY_OPTION_NAMES updated when modifying this
export interface CreateDatabaseQueryOptions {
  collate?: string;
  charset?: string;
  encoding?: string;
  ctype?: string;
  template?: string;
}

// keep CREATE_SCHEMA_QUERY_OPTION_NAMES updated when modifying this
export interface CreateSchemaQueryOptions {
  collate?: string;
  charset?: string;
}

// keep LIST_SCHEMAS_QUERY_OPTION_NAMES updated when modifying this
export interface ListSchemasQueryOptions {
  /** List of schemas to exclude from output */
  skip?: string[];
}

export class AbstractQueryGenerator {
  dialect: AbstractDialect;

  setImmediateQuery(constraints: string[]): string;
  setDeferredQuery(constraints: string[]): string;
  generateTransactionId(): string;
  whereQuery(where: object, options?: ParameterOptions): string;
  whereItemsQuery(where: WhereOptions, options: WhereItemsQueryOptions, binding?: string): string;
  quoteTable(param: TableName, alias?: string | boolean): string;
  escape(value: unknown, field?: unknown, options?: ParameterOptions): string;
  quoteIdentifier(identifier: string, force?: boolean): string;
  quoteIdentifiers(identifiers: string): string;
  handleSequelizeMethod(
    smth: SequelizeMethod,
    tableName?: TableName,
    factory?: ModelStatic,
    options?: HandleSequelizeMethodOptions,
    prepend?: boolean,
  ): string;

  selectQuery<M extends Model>(tableName: string, options?: SelectOptions<M>, model?: ModelStatic<M>): string;
  insertQuery(
    table: TableName,
    valueHash: object,
    columnDefinitions?: { [columnName: string]: BuiltModelAttributeColumOptions },
    options?: InsertOptions
  ): { query: string, bind?: unknown[] };
  bulkInsertQuery(
    tableName: TableName,
    newEntries: object[],
    options?: BulkInsertOptions,
    columnDefinitions?: { [columnName: string]: BuiltModelAttributeColumOptions }
  ): string;

  updateQuery(
    tableName: TableName,
    attrValueHash: object,
    where: WhereOptions,
    options?: UpdateOptions,
    columnDefinitions?: { [columnName: string]: BuiltModelAttributeColumOptions },
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

  createSchemaQuery(schemaName: string, options?: CreateSchemaQueryOptions): string;
  dropSchemaQuery(schemaName: string): string | { query: string, bind?: unknown[] };
  listSchemasQuery(options?: ListSchemasQueryOptions): string;

  createDatabaseQuery(databaseName: string, options?: CreateDatabaseQueryOptions): string;
  dropDatabaseQuery(databaseName: string): string;
  listDatabasesQuery(): string;
}
