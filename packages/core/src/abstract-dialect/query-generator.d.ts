// TODO: complete me - this file is a stub that will be completed when query-generator.ts is migrated to TS

import type { Col } from '../expression-builders/col.js';
import type { Literal } from '../expression-builders/literal.js';
import type {
  AttributeOptions,
  Attributes,
  FindOptions,
  Model,
  ModelStatic,
  NormalizedAttributeOptions,
  SearchPathable,
} from '../model.js';
import type { DataType } from './data-types.js';
import type { AbstractDialect } from './dialect.js';
import type {
  AbstractQueryGeneratorTypeScript,
  ParameterOptions,
} from './query-generator-typescript.js';
import type { BoundQuery, TableOrModel, UnionOptions } from './query-generator.types.js';
import type { IndexOptions, TableName } from './query-interface.js';
import type { WhereOptions } from './where-sql-builder-types.js';

type SelectOptions<M extends Model> = FindOptions<Attributes<M>> & {
  /**
   * Only required when the query includes associations
   */
  model?: ModelStatic<M>;

  /**
   * When the query has includes, attributes are prefixed with the name of the main table,
   * except for attributes that contain a dot. Set this to also prefix those.
   */
  dotNotation?: boolean;
};

type InsertOptions = ParameterOptions &
  SearchPathable & {
    exception?: boolean;
    updateOnDuplicate?: string[];
    ignoreDuplicates?: boolean;
    upsertKeys?: string[];
    conflictWhere?: WhereOptions;
    returning?: boolean | Array<string | Literal | Col>;
    hasTrigger?: boolean;
    omitNull?: boolean;
  };

type BulkInsertOptions = ParameterOptions & {
  hasTrigger?: boolean;
  updateOnDuplicate?: string[];
  ignoreDuplicates?: boolean;
  upsertKeys?: string[];
  conflictWhere?: WhereOptions;
  returning?: boolean | Array<string | Literal | Col>;
};

type UpdateOptions = ParameterOptions &
  SearchPathable & {
    returning?: boolean | Array<string | Literal | Col>;
    hasTrigger?: boolean;
    limit?: number | Literal | null;
    omitNull?: boolean;
  };

type AddIndexQueryOptions = Omit<IndexOptions, 'fields'>;

type ArithmeticQueryOptions = ParameterOptions & {
  returning?: boolean | Array<string | Literal | Col>;
};

// keep CREATE_TABLE_QUERY_SUPPORTABLE_OPTIONS updated when modifying this
export interface CreateTableQueryOptions {
  collate?: string;
  charset?: string;
  engine?: string;
  rowFormat?: string;
  comment?: string;
  initialAutoIncrement?: number;
  /**
   * Used for compound unique keys.
   */
  uniqueKeys?: Array<{ fields: string[] }> | { [indexName: string]: { fields: string[] } };
}

// keep ADD_COLUMN_QUERY_SUPPORTABLE_OPTIONS updated when modifying this
export interface AddColumnQueryOptions {
  ifNotExists?: boolean;
}

/**
 * The base class for all query generators, used to generate all SQL queries.
 *
 * The implementation varies between SQL dialects, and is overridden by subclasses. You can access your dialect's version
 * through {@link Sequelize#queryGenerator}.
 */
export class AbstractQueryGenerator<
  Dialect extends AbstractDialect = AbstractDialect,
> extends AbstractQueryGeneratorTypeScript<Dialect> {
  quoteIdentifiers(identifiers: string): string;

  selectQuery<M extends Model>(
    tableName: TableName,
    options?: SelectOptions<M>,
    model?: ModelStatic<M>,
  ): string;
  insertQuery(
    table: TableName,
    valueHash: object,
    columnDefinitions?: { [columnName: string]: NormalizedAttributeOptions },
    options?: InsertOptions,
  ): BoundQuery;
  bulkInsertQuery(
    tableName: TableName,
    newEntries: object[],
    options?: BulkInsertOptions,
    columnDefinitions?: { [columnName: string]: NormalizedAttributeOptions },
  ): string;

  /**
   * @param tableName The table to add the index to
   * @param attributes The columns to index. Can also be passed as `options.fields`
   * @param options
   * @param rawTablename The name of the table without its schema, used to generate the index name
   */
  addIndexQuery(
    tableName: TableName,
    attributes: NonNullable<IndexOptions['fields']>,
    options?: AddIndexQueryOptions,
    rawTablename?: string,
  ): string;
  addIndexQuery(
    tableName: TableName,
    options: AddIndexQueryOptions & Required<Pick<IndexOptions, 'fields'>>,
  ): string;

  addColumnQuery(
    table: TableName,
    columnName: string,
    columnDefinition: AttributeOptions | DataType,
    options?: AddColumnQueryOptions,
  ): string;

  updateQuery(
    tableName: TableName,
    attrValueHash: object,
    where: WhereOptions,
    options?: UpdateOptions,
    columnDefinitions?: { [columnName: string]: NormalizedAttributeOptions },
  ): BoundQuery;

  arithmeticQuery(
    operator: string,
    tableName: TableName,
    where: WhereOptions,
    incrementAmountsByField: { [key: string]: number | Literal },
    extraAttributesToBeUpdated: { [key: string]: unknown },
    options?: ArithmeticQueryOptions,
  ): string;

  createTableQuery(
    tableName: TableOrModel,
    // TODO: rename attributes to columns and accept a map of attributes in the implementation when migrating to TS, see https://github.com/sequelize/sequelize/pull/15526/files#r1143840411
    columns: { [columnName: string]: string },
    options?: CreateTableQueryOptions,
  ): string;

  unionQuery(sqls: string[], options?: UnionOptions): string;
}
