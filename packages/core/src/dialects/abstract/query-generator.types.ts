import type { Class } from 'type-fest';
import type { Deferrable } from '../../deferrable';
import type { BaseSqlExpression } from '../../expression-builders/base-sql-expression';
import type { ReferentialAction } from '../../model';
import type { BindOrReplacements } from '../../sequelize';
import type { TableNameOrModel } from './query-generator-typescript';
import type { WhereOptions } from './where-sql-builder-types';

export interface QueryWithBindParams {
  query: string;
  bind: BindOrReplacements;
}

export interface BaseConstraintQueryOptions {
  name?: string;
  type: 'CHECK' | 'DEFAULT' | 'FOREIGN KEY' | 'PRIMARY KEY' | 'UNIQUE';
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

export interface DeferConstraintsQueryOptions {
  deferrable: Deferrable | Class<Deferrable>;
}

export interface GetConstraintSnippetQueryOptions {
  name?: string;
  type: 'CHECK' | 'DEFAULT' | 'FOREIGN KEY' | 'PRIMARY KEY' | 'UNIQUE';
  fields: Array<string | BaseSqlExpression | { attribute?: string, name: string }>;
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
