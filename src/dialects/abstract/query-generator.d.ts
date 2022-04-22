// TODO: complete me - this file is a stub that will be completed when query-generator.ts is migrated to TS

import { AbstractDialect } from './index.js';
import {
  BuiltModelAttributeColumOptions,
  FindOptions,
  Model,
  ModelStatic,
  SearchPathable,
  WhereOptions,
} from '../../model.js';
import { TableName } from './query-interface.js';
import { BindContext } from './query.js';
import { BindOrReplacements } from '../../sequelize.js';

type ParameterOptions = {
  // only named replacements are allowed
  replacements?: { [key: string]: unknown },
  bind?: BindOrReplacements,
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
  returning?: boolean | Array<string>,
};

type BulkInsertOptions = ParameterOptions & {
  hasTrigger?: boolean,

  updateOnDuplicate?: string[],
  ignoreDuplicates?: boolean,
  upsertKeys?: string[],
  returning?: boolean | Array<string>,
};

type UpdateOptions = ParameterOptions & {
  bindParam?: false | ((value: unknown) => string),
};

export class AbstractQueryGenerator {
  _dialect: AbstractDialect;

  setImmediateQuery(constraints: string[]): string;
  setDeferredQuery(constraints: string[]): string;
  generateTransactionId(): string;
  whereQuery(where: object, options: ParameterOptions, bindContext: BindContext): string;
  whereItemsQuery(where: WhereOptions, options: ParameterOptions, binding: string, bindContext: BindContext): string;
  quoteTable(param: TableName, alias?: string | boolean): string;
  escape(value: unknown, field: unknown, options: ParameterOptions, bindContext: BindContext): string;
  quoteIdentifier(identifier: string, force?: boolean): string;
  quoteIdentifiers(identifiers: string): string;

  selectQuery<M extends Model>(tableName: string, options: SelectOptions<M>, model: ModelStatic<M>, bindContext: BindContext): string;
  insertQuery(
    table: TableName,
    valueHash: object,
    columnDefinitions: { [columnName: string]: BuiltModelAttributeColumOptions },
    options: InsertOptions
  ): { query: string, bind?: Array<unknown> };
  bulkInsertQuery(tableName: TableName, newEntries: Array<object>, options: BulkInsertOptions, columnDefinitions: { [columnName: string]: BuiltModelAttributeColumOptions }, bindContext: BindContext): string;

  updateQuery(
    tableName: TableName,
    attrValueHash: object,
    where: WhereOptions,
    options: UpdateOptions,
    columnDefinitions: { [columnName: string]: BuiltModelAttributeColumOptions },
  ): { query: string, bind?: Array<unknown> };
}
