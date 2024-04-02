import type { Deferrable } from '../deferrable';
import type { QueryRawOptions } from '../sequelize';
import type { IsolationLevel } from '../transaction';
import type {
  AddConstraintQueryOptions,
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
  RenameTableQueryOptions,
  ShowConstraintsQueryOptions,
  StartTransactionQueryOptions,
  TruncateTableQueryOptions,
} from './query-generator.types';

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
