import type { Deferrable } from '../../deferrable';
import type { BaseSqlExpression } from '../../expression-builders/base-sql-expression';
import type { Literal } from '../../expression-builders/literal';
import type { Filterable, IndexHintable, ReferentialAction } from '../../model';
import type { BindOrReplacements } from '../../sequelize';
import type { TableHints } from '../../table-hints';
import type { TransactionType } from '../../transaction';
import type { Nullish } from '../../utils/types';
import type { TableOrModel } from './query-generator-typescript';
import type { ConstraintType } from './query-interface.types';
import type { WhereOptions } from './where-sql-builder-types';

// keep CREATE_DATABASE_QUERY_SUPPORTABLE_OPTIONS updated when modifying this
export interface CreateDatabaseQueryOptions {
  charset?: string;
  collate?: string;
  ctype?: string;
  encoding?: string;
  template?: string;
}

// keep LIST_DATABASES_QUERY_SUPPORTABLE_OPTIONS updated when modifying this
export interface ListDatabasesQueryOptions {
  skip?: string[];
}

// keep CREATE_SCHEMA_QUERY_SUPPORTABLE_OPTIONS updated when modifying this
export interface CreateSchemaQueryOptions {
  authorization?: string | Literal;
  charset?: string;
  collate?: string;
  comment?: string;
  ifNotExists?: boolean;
  replace?: boolean;
}

// keep DROP_SCHEMA_QUERY_SUPPORTABLE_OPTIONS updated when modifying this
export interface DropSchemaQueryOptions {
  cascade?: boolean;
  ifExists?: boolean;
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

// keep RENAME_TABLE_QUERY_SUPPORTABLE_OPTIONS updated when modifying this
export interface RenameTableQueryOptions {
  changeSchema?: boolean;
}

// Keep TRUNCATE_TABLE_QUERY_SUPPORTABLE_OPTIONS updated when modifying this
export interface TruncateTableQueryOptions {
  cascade?: boolean;
  restartIdentity?: boolean;
}

// keep REMOVE_COLUMN_QUERY_SUPPORTABLE_OPTIONS updated when modifying this
export interface RemoveColumnQueryOptions {
  cascade?: boolean;
  ifExists?: boolean;
}

export interface BaseConstraintQueryOptions {
  name?: string;
  type: ConstraintType;
  fields: Array<string | BaseSqlExpression | { attribute?: string; name: string }>;
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
  references:
    | {
        table: TableOrModel;
        field?: string;
        fields: string[];
      }
    | {
        table: TableOrModel;
        field: string;
        fields?: string[];
      };
  onDelete?: ReferentialAction;
  onUpdate?: ReferentialAction;
  deferrable?: Deferrable;
}

export type AddConstraintQueryOptions =
  | AddCheckConstraintQueryOptions
  | AddUniqueConstraintQueryOptions
  | AddDefaultConstraintQueryOptions
  | AddPrimaryKeyConstraintQueryOptions
  | AddForeignKeyConstraintQueryOptions;

export interface GetConstraintSnippetQueryOptions {
  name?: string;
  type: ConstraintType;
  fields: Array<
    | string
    | BaseSqlExpression
    | {
        /**
         * @deprecated use `name` instead
         */
        attribute?: string;
        name: string;
      }
  >;
  where?: WhereOptions<any>;
  defaultValue?: unknown;
  references?:
    | {
        table: TableOrModel;
        field?: string;
        fields: string[];
      }
    | {
        table: TableOrModel;
        field: string;
        fields?: string[];
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

// keep START_TRANSACTION_QUERY_SUPPORTABLE_OPTIONS updated when modifying this
export interface StartTransactionQueryOptions {
  readOnly?: boolean;
  transactionName?: string;
  transactionType?: TransactionType | undefined;
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

export interface AddLimitOffsetOptions {
  limit?: Nullish<number | Literal>;
  offset?: Nullish<number | Literal>;
  replacements?: BindOrReplacements;
}

export interface BulkDeleteQueryOptions extends AddLimitOffsetOptions, Filterable {}
