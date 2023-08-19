import type { Deferrable } from '../../deferrable';
import type { BaseSqlExpression } from '../../expression-builders/base-sql-expression';
import type { AttributeOptions, IndexHintable, ReferentialAction } from '../../model';
import type { BindOrReplacements } from '../../sequelize';
import type { TableHints } from '../../table-hints';
import type { Nullish } from '../../utils/types.js';
import type { DataType, DataTypeInstance } from './data-types.js';
import type { TableNameOrModel } from './query-generator-typescript';
import type { ConstraintType } from './query-interface.types';
import type { WhereOptions } from './where-sql-builder-types';

export interface QueryWithBindParams {
  query: string;
  bind: BindOrReplacements;
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

export interface ShowConstraintsQueryOptions {
  constraintName?: string;
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

export type ChangeColumnDefinitions = {
  [attributeName: string]: DataType | ChangeColumnDefinition,
};

export type ChangeColumnDefinition = Partial<Omit<AttributeOptions, 'primaryKey' | 'unique'>> & {
  /**
   * Only 'true' is allowed, because changeColumns can add a single-column unique, but does not have access to enough information
   * to add a multi-column unique, or removing a column from a unique index.
   */
  unique?: boolean | Nullish,

  /**
   * Set to true to remove the defaultValue.
   *
   * Cannot be used in conjunction with defaultValue.
   */
  dropDefaultValue?: boolean,
};

export type NormalizedChangeColumnDefinition = Omit<ChangeColumnDefinition, 'type'> & {
  type?: DataTypeInstance | string | Nullish,
};
