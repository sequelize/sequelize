import type { Nullish } from '@sequelize/utils';
import type { Writable } from 'type-fest';
import type { BaseSqlExpression } from '../expression-builders/base-sql-expression.js';
import type { FormatWhereOptions } from './query-generator-typescript.js';

export interface AddLimitOffsetOptions extends Writable<FormatWhereOptions, 'replacements'> {
  limit?: number | BaseSqlExpression | Nullish;
  offset?: number | BaseSqlExpression | Nullish;
}

export interface AttributeToSqlOptions {
  context: 'addColumn' | 'changeColumn' | 'createTable';
  schema?: string;
  table: string;
  withoutForeignKeyConstraints?: boolean;
}
