import type { Deferrable } from '../deferrable';
import type { TableHints } from '../enums';
import type { BaseSqlExpression } from '../expression-builders/base-sql-expression';
import type { Literal } from '../expression-builders/literal';
import type {
  Attributes,
  Filterable,
  FindOptions,
  IndexHintable,
  Model,
  ModelStatic,
  OrderDirection,
  ReferentialAction,
} from '../model';
import type { ModelDefinition } from '../model-definition.js';
import type { QueryRawOptions } from '../sequelize';
import type { TransactionType } from '../transaction';
import type { AbstractDataType } from './data-types.js';
import type { AddLimitOffsetOptions } from './query-generator.internal-types.js';
import type { TableName } from './query-interface.js';
import type { ConstraintType } from './query-interface.types';
import type { WhereOptions } from './where-sql-builder-types';

export type TableOrModel = TableName | ModelStatic<any> | ModelDefinition<any>;

/**
 * Describes one of the columns produced by a member query of a UNION.
 *
 * Because a UNION takes its result column names from its first member,
 * {@link UnionColumnDescriptor.name} is the name the column has in the result set (the attribute
 * name, or the user-provided alias), not the name of the underlying table column.
 */
export interface UnionColumnDescriptor {
  /** The name this column has in the result set of the UNION. */
  name: string;

  /**
   * The data type of the column, or `null` when it cannot be determined
   * (e.g. the attribute is an arbitrary SQL expression). Columns whose type is unknown are skipped
   * by the type compatibility check.
   */
  dataType: AbstractDataType<any> | null;
}

/**
 * A single entry of {@link UnionOptions.order}.
 *
 * A UNION's result set only contains the columns selected by its member queries, so ordering may
 * only reference those columns by name. Use {@link Literal} (`sql.literal`) as an escape hatch for
 * expressions that cannot be expressed as a plain column reference.
 */
export type UnionOrderItem =
  | string
  | [column: string, direction: OrderDirection]
  | BaseSqlExpression;

/**
 * Options that apply to the combined result set of a UNION, as opposed to its individual members.
 */
export interface UnionOptions extends QueryRawOptions, AddLimitOffsetOptions {
  /**
   * Whether to keep duplicate rows (`UNION ALL`) instead of removing them (`UNION`).
   *
   * @default false
   */
  unionAll?: boolean;

  /**
   * Specifies the ordering of the combined result set.
   *
   * Each entry is either the name of one of the result columns, a two-element array of
   * `[column, direction]`, or a {@link Literal}.
   *
   * @example
   * `order: ['velocity']`.
   * @example
   * `order: [['velocity', 'DESC']]`.
   */
  order?: UnionOrderItem[];
}

/**
 * The options accepted by a member query of {@link Sequelize#union}.
 *
 * `include` is not supported, because eager-loading changes which columns a query selects, which
 * would break the column alignment a UNION requires.
 *
 * `limit`, `offset` and `order` are not supported either: SQLite does not accept those clauses
 * inside a compound SELECT, and MySQL requires the member to be parenthesized, so allowing them
 * would produce queries that work on some dialects and break on others. Use the equivalent options
 * of {@link UnionOptions} to paginate and sort the combined result set instead.
 */
export type UnionQueryOptions<M extends Model> = Omit<
  FindOptions<Attributes<M>>,
  'include' | 'limit' | 'offset' | 'order'
> & {
  include?: never;
  limit?: never;
  offset?: never;
  order?: never;
};

/**
 * A single member query of {@link Sequelize#union}.
 */
export interface UnionQuery<M extends Model = Model> {
  model: ModelStatic<M>;
  options?: UnionQueryOptions<M>;
}

/**
 * A row of the result set of {@link Sequelize#union}.
 *
 * **Note:** union results are plain objects, not model instances. A UNION can combine rows coming
 * from different models, so there is no single model that could faithfully represent every row. As
 * a consequence getters, virtual attributes and instance methods such as `toJSON()` are not
 * available on these rows.
 *
 * The known keys are those of the first member query's model, since a UNION takes its result column
 * names from its first member. Aliased attributes are typed as `unknown`.
 */
export type UnionRow<M extends Model = Model> = Partial<Attributes<M>> & Record<string, unknown>;

export interface BoundQuery {
  query: string;
  bind?: Record<string, unknown> | undefined;
}

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

export interface QuoteTableOptions extends IndexHintable {
  alias: boolean | string;
  tableHints?: TableHints[] | undefined;
}

export interface BulkDeleteQueryOptions<TAttributes = any>
  extends AddLimitOffsetOptions,
    Filterable<TAttributes> {}

// keep REMOVE_INDEX_QUERY_SUPPORTABLE_OPTIONS updated when modifying this
export interface RemoveIndexQueryOptions {
  concurrently?: boolean;
  ifExists?: boolean;
  cascade?: boolean;
}
