import type { Deferrable } from '../../deferrable';
import type { BaseSqlExpression } from '../../expression-builders/base-sql-expression';
import type { IndexHintable, ReferentialAction } from '../../model';
import type { BindOrReplacements } from '../../sequelize';
import type { TableHints } from '../../table-hints';
import type { TableNameOrModel } from './query-generator-typescript';
import type { ConstraintType } from './query-interface.types';
import type { WhereOptions } from './where-sql-builder-types';

export interface QueryWithBindParams {
  query: string;
  bind: BindOrReplacements;
}

export interface ListSchemasQueryOptions {
  /** List of schemas to exclude from output */
  skip?: string[];
}

// keep DROP_TABLE_QUERY_SUPPORTABLE_OPTIONS updated when modifying this
export interface DropTableQueryOptions {
  cascade?: boolean;
}

// Keeep LIST_TABLES_QUERY_SUPPORTABLE_OPTIONS updated when modifying this
export interface ListTablesQueryOptions {
  schema?: string;
}

// keep REMOVE_COLUMN_QUERY_SUPPORTABLE_OPTIONS updated when modifying this
export interface RemoveColumnQueryOptions {
  cascade?: boolean;
  ifExists?: boolean;
}

export interface BaseConstraintQueryOptions {
  name?: string;
  type: ConstraintType;
  fields: Array<string | BaseSqlExpression | { attribute?: string, name: string }>;
}

export interface AddCheckConstraintQueryOptions extends BaseConstraintQueryOptions {
  type: 'CHECK';
  where?: WhereOptions<any>;
}
export interface AddDefaultConstraintQueryOptions extends BaseConstraintQueryOptions {
  type: 'DEFAULT';
  defaultValue?: unknown;
}

export interface AddUniqueConstraintQueryOptions extends BaseConstraintQueryOptions {
  type: 'UNIQUE';
  deferrable?: Deferrable;
}

export interface AddPrimaryKeyConstraintQueryOptions extends BaseConstraintQueryOptions {
  type: 'PRIMARY KEY';
  deferrable?: Deferrable;
}

export interface AddForeignKeyConstraintQueryOptions extends BaseConstraintQueryOptions {
  type: 'FOREIGN KEY';
  references: {
    table: TableNameOrModel,
    field?: string,
    fields: string[],
  } | {
    table: TableNameOrModel,
    field: string,
    fields?: string[],
  };
  onDelete?: ReferentialAction;
  onUpdate?: ReferentialAction;
  deferrable?: Deferrable;
}

export type AddConstraintQueryOptions =
  AddCheckConstraintQueryOptions
  | AddUniqueConstraintQueryOptions
  | AddDefaultConstraintQueryOptions
  | AddPrimaryKeyConstraintQueryOptions
  | AddForeignKeyConstraintQueryOptions;

export interface GetConstraintSnippetQueryOptions {
  name?: string;
  type: ConstraintType;
  fields: Array<string | BaseSqlExpression | {
    /**
     * @deprecated use `name` instead
     */
    attribute?: string,
    name: string,
  }>;
  where?: WhereOptions<any>;
  defaultValue?: unknown;
  references?: {
    table: TableNameOrModel,
    field?: string,
    fields: string[],
  } | {
    table: TableNameOrModel,
    field: string,
    fields?: string[],
  };
  onDelete?: ReferentialAction;
  onUpdate?: ReferentialAction;
  deferrable?: Deferrable;
}

// keep REMOVE_CONSTRAINT_QUERY_SUPPORTABLE_OPTIONS updated when modifying this
export interface RemoveConstraintQueryOptions {
  ifExists?: boolean;
  cascade?: boolean;
}

// keep SHOW_CONSTRAINTS_QUERY_SUPPORTABLE_OPTIONS updated when modifying this
export interface ShowConstraintsQueryOptions {
  columnName?: string;
  constraintName?: string;
  constraintType?: ConstraintType;
}

export interface AttributeToSqlOptions {
  context: 'addColumn' | 'changeColumn' | 'createTable';
  schema?: string;
  table: string;
  withoutForeignKeyConstraints?: boolean;
}

export interface QuoteTableOptions extends IndexHintable {
  alias: boolean | string;
  tableHints?: TableHints[];
}
