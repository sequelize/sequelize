// TODO: complete me - this file is a stub that will be completed when query-generator.ts is migrated to TS

import { AbstractDialect } from './index.js';
import { WhereOptions } from '../../model.js';
import { TableName } from './query-interface.js';
import { BindContext } from './query.js';

export class AbstractQueryGenerator {
  _dialect: AbstractDialect;

  setImmediateQuery(constraints: string[]): string;
  setDeferredQuery(constraints: string[]): string;
  generateTransactionId(): string;
  whereQuery(options: object): string;
  whereItemsQuery(whereObj: WhereOptions, options?: object, binding?: string): string;
  quoteTable(param: TableName, alias?: string | boolean): string;
  escape(value: unknown, field: unknown, options: unknown, bindContext: BindContext): string;
  quoteIdentifier(identifier: string, force?: boolean): string;
  quoteIdentifiers(identifiers: string): string;
}
