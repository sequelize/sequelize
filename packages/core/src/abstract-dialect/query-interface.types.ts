import type { Deferrable } from '../deferrable';
import type { BaseSqlExpression } from '../expression-builders/base-sql-expression';
import type { QueryRawOptions } from '../sequelize';
import type { IsolationLevel } from '../transaction';
import type { AllowLowercase } from '../utils/types';
import type {
  AddConstraintQueryOptions,
  AddIndexQueryOptions,
  BulkDeleteQueryOptions,
  CreateDatabaseQueryOptions,
  CreateSchemaQueryOptions,
  DropSchemaQueryOptions,
  DropTableQueryOptions,
  ListDatabasesQueryOptions,
  ListSchemasQueryOptions,
  ListTablesQueryOptions,
  RemoveColumnQueryOptions,
  RemoveConstraintQueryOptions,
  RemoveIndexQueryOptions,
  RenameTableQueryOptions,
  ShowConstraintsQueryOptions,
  StartTransactionQueryOptions,
  TruncateTableQueryOptions,
} from './query-generator.types';
import type { WhereOptions } from './where-sql-builder-types';

export interface DatabaseDescription {
  name: string;
}

export interface ColumnDescription {
  type: string;
  allowNull: boolean;
  defaultValue: string;
  primaryKey: boolean;
  autoIncrement: boolean;
  comment: string | null;
}

export type ColumnsDescription = Record<string, ColumnDescription>;

export type ConstraintType = 'CHECK' | 'DEFAULT' | 'FOREIGN KEY' | 'PRIMARY KEY' | 'UNIQUE';

export interface RawConstraintDescription {
  constraintCatalog?: string;
  constraintSchema: string;
  constraintName: string;
  constraintType: ConstraintType;
  tableCatalog?: string;
  tableSchema: string;
  tableName: string;
  columnNames?: string;
  referencedTableSchema?: string;
  referencedTableName?: string;
  referencedColumnNames?: string;
  deleteAction?: string;
  updateAction?: string;
  definition?: string;
  isDeferrable?: string;
  initiallyDeferred?: string;
}

export interface ConstraintDescription {
  constraintCatalog?: string;
  constraintSchema: string;
  constraintName: string;
  constraintType: ConstraintType;
  tableCatalog?: string;
  tableSchema: string;
  tableName: string;
  columnNames?: string[];
  referencedTableSchema?: string;
  referencedTableName?: string;
  referencedColumnNames?: string[];
  deleteAction?: string;
  updateAction?: string;
  definition?: string;
  deferrable?: Deferrable;
}

export type IndexType = AllowLowercase<'UNIQUE' | 'FULLTEXT' | 'SPATIAL'>;

export type IndexMethod = 'BTREE' | 'HASH' | 'GIST' | 'SPGIST' | 'GIN' | 'BRIN' | string;

export interface IndexField {
  /**
   * The name of the column
   */
  name: string;

  /**
   * Create a prefix index of length chars
   */
  length?: number;

  /**
   * The direction the column should be sorted in
   */
  order?: 'ASC' | 'DESC';

  /**
   * The collation (sort order) for the column
   */
  collate?: string;

  /**
   * Index operator type. Postgres only
   */
  operator?: string;
}

export interface IndexOptions {
  /**
   * The name of the index. Defaults to model name + _ + fields concatenated
   */
  name?: string;

  /**
   * For FULLTEXT columns set your parser
   */
  parser?: string;

  /**
   * Index type. Only used by mysql. One of `UNIQUE`, `FULLTEXT` and `SPATIAL`
   */
  type?: IndexType | undefined;

  /**
   * Should the index by unique? Can also be triggered by setting type to `UNIQUE`
   *
   * @default false
   */
  unique?: boolean;

  /**
   * The message to display if the unique constraint is violated.
   */
  msg?: string;

  /**
   * PostgreSQL will build the index without taking any write locks. Postgres only.
   *
   * @default false
   */
  concurrently?: boolean;

  /**
   * The fields to index.
   */
  // TODO: rename to "columns"
  fields: Array<string | IndexField | BaseSqlExpression>;

  /**
   * The method to create the index by (`USING` statement in SQL).
   * BTREE and HASH are supported by MariaDB, MySQL and Postgres.
   * Postgres additionally supports GIST, SPGIST, BRIN and GIN.
   */
  method?: IndexMethod | undefined;

  /**
   * Index operator type. Postgres only
   */
  operator?: string;

  /**
   * Optional where parameter for index. Can be used to limit the index to certain rows.
   */
  where?: WhereOptions;

  /**
   * Prefix to append to the index name.
   */
  prefix?: string;

  /**
   * Non-key columns to be added to the lead level of the nonclustered index.
   */
  include?: BaseSqlExpression | Array<string | BaseSqlExpression>;
}

export interface IndexFieldDescription {
  name: string;
  order: 'DESC' | 'ASC' | undefined;
  length?: number | undefined;
  collate?: string | undefined;
  operator?: string | undefined;
}

export interface IndexDescription {
  tableName: string;
  schema?: string | undefined;
  name: string;
  type?: string | undefined;
  method?: string | undefined;
  unique: boolean;
  primary: boolean;
  expression?: string | undefined;
  fields: IndexFieldDescription[];
  includes?: string[] | undefined;
}

/** Options accepted by {@link AbstractQueryInterface#createDatabase} */
export interface CreateDatabaseOptions extends CreateDatabaseQueryOptions, QueryRawOptions {}

/** Options accepted by {@link AbstractQueryInterface#listDatabases} */
export interface ListDatabasesOptions extends ListDatabasesQueryOptions, QueryRawOptions {}

/** Options accepted by {@link AbstractQueryInterface#createSchema} */
export interface CreateSchemaOptions extends CreateSchemaQueryOptions, QueryRawOptions {}

/** Options accepted by {@link AbstractQueryInterface#dropSchema} */
export interface DropSchemaOptions extends DropSchemaQueryOptions, QueryRawOptions {}

/** Options accepted by {@link AbstractQueryInterface#listSchemas} */
export interface QiListSchemasOptions extends ListSchemasQueryOptions, QueryRawOptions {}

/** Options accepted by {@link AbstractQueryInterface#dropAllSchemas} */
export interface QiDropAllSchemasOptions extends DropSchemaOptions, QueryRawOptions {
  /**
   * List of schemas to skip dropping (i.e., list of schemas to keep)
   */
  skip?: string[];
}

/** Options accepted by {@link AbstractQueryInterface#listTables} */
export interface QiListTablesOptions extends ListTablesQueryOptions, QueryRawOptions {}

/** Options accepted by {@link AbstractQueryInterface#describeTable} */
export interface DescribeTableOptions extends QueryRawOptions {
  /**
   * @deprecated Use a TableNameWithSchema object to specify the schema or set the schema globally in the options.
   */
  schema?: string;
  /**
   * @deprecated Use a TableNameWithSchema object to specify the schemaDelimiter.
   */
  schemaDelimiter?: string;
}

/** Options accepted by {@link AbstractQueryInterface#dropTable} */
export interface QiDropTableOptions extends DropTableQueryOptions, QueryRawOptions {}

/** Options accepted by {@link AbstractQueryInterface#dropAllTables} */
export interface QiDropAllTablesOptions extends ListTablesQueryOptions, QiDropTableOptions {
  skip?: string[];
}

/** Options accepted by {@link AbstractQueryInterface#renameTable} */
export interface RenameTableOptions extends RenameTableQueryOptions, QueryRawOptions {}

/** Options accepted by {@link AbstractQueryInterface#truncate} */
export interface QiTruncateTableOptions extends TruncateTableQueryOptions, QueryRawOptions {}

export interface FetchDatabaseVersionOptions extends Omit<QueryRawOptions, 'type' | 'plain'> {}

/** Options accepted by {@link AbstractQueryInterface#removeColumn} */
export interface RemoveColumnOptions extends RemoveColumnQueryOptions, QueryRawOptions {}

/** Options accepted by {@link AbstractQueryInterface#addConstraint} */
export type AddConstraintOptions = AddConstraintQueryOptions & QueryRawOptions;

/** Options accepted by {@link AbstractQueryInterface#deferConstraints} */
export interface DeferConstraintsOptions extends QueryRawOptions {}

/** Options accepted by {@link AbstractQueryInterface#removeConstraint} */
export interface RemoveConstraintOptions extends RemoveConstraintQueryOptions, QueryRawOptions {}

/** Options accepted by {@link AbstractQueryInterface#showConstraints} */
export interface ShowConstraintsOptions extends ShowConstraintsQueryOptions, QueryRawOptions {}

/** Options accepted by {@link AbstractQueryInterface#addIndex} */
export interface QiAddIndexOptions extends AddIndexQueryOptions, Omit<QueryRawOptions, 'type'> {}

/** Options accepted by {@link AbstractQueryInterface#removeIndex} */
export interface QiRemoveIndexOptions
  extends RemoveIndexQueryOptions,
    Omit<QueryRawOptions, 'type'> {}

/** Options accepted by {@link AbstractQueryInterface#_commitTransaction} */
export interface CommitTransactionOptions
  extends Omit<QueryRawOptions, 'connection' | 'transaction' | 'supportsSearchPath'> {}

/** Options accepted by {@link AbstractQueryInterface#_createSavepoint} */
export interface CreateSavepointOptions
  extends Omit<QueryRawOptions, 'connection' | 'transaction' | 'supportsSearchPath'> {
  savepointName: string;
}

/** Options accepted by {@link AbstractQueryInterface#_rollbackSavepoint} */
export interface RollbackSavepointOptions
  extends Omit<QueryRawOptions, 'connection' | 'transaction' | 'supportsSearchPath'> {
  savepointName: string;
}

/** Options accepted by {@link AbstractQueryInterface#_rollbackTransaction} */
export interface RollbackTransactionOptions
  extends Omit<QueryRawOptions, 'connection' | 'transaction' | 'supportsSearchPath'> {}

/** Options accepted by {@link AbstractQueryInterface#_setIsolationLevel} */
export interface SetIsolationLevelOptions
  extends Omit<QueryRawOptions, 'connection' | 'transaction' | 'supportsSearchPath'> {
  isolationLevel: IsolationLevel;
}

/** Options accepted by {@link AbstractQueryInterface#_startTransaction} */
export interface StartTransactionOptions
  extends StartTransactionQueryOptions,
    Omit<QueryRawOptions, 'connection' | 'transaction' | 'supportsSearchPath'> {
  isolationLevel?: IsolationLevel | null | undefined;
}

/** Options accepted by {@link AbstractQueryInterface#bulkDelete} */
export interface QiBulkDeleteOptions<TAttributes = any>
  extends BulkDeleteQueryOptions<TAttributes>,
    Omit<QueryRawOptions, 'raw' | 'type'> {}
