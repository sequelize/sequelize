import type { Nullish } from '@sequelize/utils';
import type { Literal } from '../expression-builders/literal.js';
import type { BindOrReplacements } from '../sequelize.js';
import type { TableOrModel } from './query-generator.types.js';

export interface AddLimitOffsetOptions {
  limit?: number | Literal | Nullish;
  offset?: number | Literal | Nullish;
  replacements?: BindOrReplacements | undefined;
}

export interface AttributeToSqlOptions {
  context: 'addColumn' | 'changeColumn' | 'createTable';
  table?: TableOrModel;
  withoutForeignKeyConstraints?: boolean;
  foreignKey?: string;
}
