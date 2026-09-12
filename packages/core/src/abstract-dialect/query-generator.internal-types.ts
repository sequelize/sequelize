import type { Nullish } from '@sequelize/utils';
import type { Deferrable } from '../deferrable.js';
import type { Literal } from '../expression-builders/literal.js';
import type { ReferentialAction } from '../model.js';
import type { BindOrReplacements } from '../sequelize.js';
import type { NormalizedDataType } from './data-types.js';
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

export interface AttributeToSqlReferences {
  table: TableOrModel;
  key?: string;
  deferrable?: Deferrable;
}

/**
 * The column definition accepted by `attributeToSql`.
 *
 * This is deliberately wider than {@link NormalizedAttributeOptions}: the same methods are also
 * called with the output of `describeTable`, where `type` is a raw SQL string, and with hand-written
 * definitions from migrations. Not every dialect honours every property.
 */
export interface AttributeToSqlColumn {
  type: NormalizedDataType;

  /**
   * The name of the column. `attributeToSql` needs it to build CHECK constraints, foreign key
   * constraint names and column comments.
   */
  field?: string;
  columnName?: string;

  allowNull?: boolean;
  primaryKey?: boolean;
  autoIncrement?: boolean;
  autoIncrementIdentity?: boolean;
  initialAutoIncrement?: number | string;
  defaultValue?: unknown;
  unique?: boolean | string;
  comment?: string | null;

  references?: AttributeToSqlReferences;
  onDelete?: ReferentialAction | string;
  onUpdate?: ReferentialAction | string;

  /** mariadb, mysql, snowflake and ibmi only */
  first?: boolean;
  /** mariadb, mysql, snowflake and ibmi only */
  after?: string;

  [key: string]: unknown;
}

/**
 * A column definition, or just its type when nothing else needs to be specified.
 */
export type AttributeToSqlInput = AttributeToSqlColumn | NormalizedDataType;

export type AttributesToSqlColumns = Record<string, AttributeToSqlInput>;
