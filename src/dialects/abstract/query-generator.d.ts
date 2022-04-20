// TODO: complete me - this file is a stub that will be completed when query-generator.ts is migrated to TS

import { AbstractDialect } from './index.js';
import { FindOptions, Model, ModelStatic, WhereOptions } from '../../model.js';
import { BindOrReplacements, TableName } from './query-interface.js';
import { BindContext } from './query.js';

type ParameterOptions = {
  replacements?: BindOrReplacements,
  bind?: BindOrReplacements,
};

type SelectQueryOptions<M extends Model> = FindOptions<M> & {
  model: ModelStatic<M>,
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

  selectQuery<M extends Model>(tableName: string, options: SelectQueryOptions<M>, model: ModelStatic<M>, bindContext: BindContext): string;
}
