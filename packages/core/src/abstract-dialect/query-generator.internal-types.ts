import type { Nullish } from '@sequelize/utils';
import type { Literal } from '../expression-builders/literal.js';
import type { BindOrReplacements } from '../sequelize.js';

export interface AddLimitOffsetOptions {
  limit?: number | Literal | Nullish;
  offset?: number | Literal | Nullish;
  replacements?: BindOrReplacements | undefined;
}

export interface AttributeToSqlOptions {
  context: 'addColumn' | 'changeColumn' | 'createTable';
  schema?: string;
  table: string;
  withoutForeignKeyConstraints?: boolean;
}
