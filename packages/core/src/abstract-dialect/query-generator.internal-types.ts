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
  /**
   * Which query the generated SQL is destined for. Omitted when the attribute is not being
   * generated as part of one, such as when renaming a column.
   */
  context?: 'addColumn' | 'changeColumn' | 'createTable';

  /**
   * The table the attribute belongs to. Used to qualify references and to name constraints.
   */
  tableOrModel?: TableOrModel;

  withoutForeignKeyConstraints?: boolean;
}
