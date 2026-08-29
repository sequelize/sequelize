import type { Nullish } from '@sequelize/utils';
import type { Literal } from '../expression-builders/literal.js';
import type { ModelStatic } from '../model.js';
import type { BindOrReplacements } from '../sequelize.js';

export interface AddLimitOffsetOptions {
  limit?: number | Literal | Nullish;
  offset?: number | Literal | Nullish;
  replacements?: BindOrReplacements | undefined;
}

export interface AttributeToSqlOptions {
  context: 'addColumn' | 'changeColumn' | 'createTable';
  model?: ModelStatic;
  schema?: string;
  table: string;
  withoutForeignKeyConstraints?: boolean;
}
