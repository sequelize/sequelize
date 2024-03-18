// TODO: complete me - this file is a stub that will be completed when query-generator.ts is migrated to TS

import type { Col } from '../../expression-builders/col.js';
import type { Literal } from '../../expression-builders/literal.js';
import type {
  AttributeOptions,
  FindOptions,
  Model,
  ModelStatic,
  NormalizedAttributeOptions,
  SearchPathable,
} from '../../model.js';
import type { DataType } from './data-types.js';
import type { ParameterStyle } from './index.js';
import { AbstractQueryGeneratorTypeScript } from './query-generator-typescript.js';
import type { AttributeToSqlOptions } from './query-generator.internal-types.js';
import type { TableOrModel } from './query-generator.types.js';
import type { TableName } from './query-interface.js';
import type { ColumnsDescription } from './query-interface.types.js';
import type { WhereOptions } from './where-sql-builder-types.js';

type ParameterOptions = {
  parameterStyle?: ParameterStyle;
  bindParam?: false | ((value: unknown) => string);
  // only named replacements are allowed
  replacements?: { [key: string]: unknown };
};

type SelectOptions<M extends Model> = FindOptions<M> & {
  model: ModelStatic<M>;
};

type InsertOptions = ParameterOptions &
  SearchPathable & {
    exception?: boolean;

    updateOnDuplicate?: string[];
    ignoreDuplicates?: boolean;
    upsertKeys?: string[];
    returning?: boolean | Array<string | Literal | Col>;
  };

type BulkInsertOptions = ParameterOptions & {
  hasTrigger?: boolean;

  updateOnDuplicate?: string[];
  ignoreDuplicates?: boolean;
  upsertKeys?: string[];
  returning?: boolean | Array<string | Literal | Col>;
};

type UpdateOptions = ParameterOptions;

type ArithmeticQueryOptions = {
  // only named replacements are allowed
  replacements?: { [key: string]: unknown };

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

type BoundQuery = { query: string; bind?: Record<string, unknown> };

/**
 * The base class for all query generators, used to generate all SQL queries.
 *
 * The implementation varies between SQL dialects, and is overridden by subclasses. You can access your dialect's version
 * through {@link Sequelize#queryGenerator}.
 */
export class AbstractQueryGenerator extends AbstractQueryGeneratorTypeScript {
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
  ): BoundQuery;

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

  /**
   * Creates a function that can be used to collect bind parameters.
   *
   * @param bind A mutable object to which bind parameters will be added.
   */
  bindParam(bind: Record<string, unknown>): (newBind: unknown) => string;

  attributesToSQL(
    attributes: ColumnsDescription,
    options?: AttributeToSqlOptions,
  ): Record<string, string>;
}
