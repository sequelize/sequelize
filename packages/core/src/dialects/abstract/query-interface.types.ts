import type { Deferrable } from '../../deferrable';
import type { QueryRawOptions } from '../../sequelize';
import type { CreateSchemaQueryOptions } from './query-generator';
import type {
  AddConstraintQueryOptions,
  DropTableQueryOptions,
  ListSchemasQueryOptions,
  ListTablesQueryOptions,
  RemoveColumnQueryOptions,
  RemoveConstraintQueryOptions,
  ShowConstraintsQueryOptions,
} from './query-generator.types';

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

/** Options accepted by {@link AbstractQueryInterface#createSchema} */
export interface CreateSchemaOptions extends CreateSchemaQueryOptions, QueryRawOptions { }

/** Options accepted by {@link AbstractQueryInterface#showAllSchemas} */
export interface ShowAllSchemasOptions extends ListSchemasQueryOptions, QueryRawOptions { }

/** Options accepted by {@link AbstractQueryInterface#dropAllSchemas} */
export interface QiDropAllSchemasOptions extends QueryRawOptions {
  /**
   * List of schemas to skip dropping (i.e., list of schemas to keep)
   */
  skip?: string[];
}

/** Options accepted by {@link AbstractQueryInterface#showAllTables} */
export interface QiShowAllTablesOptions extends ListTablesQueryOptions, QueryRawOptions { }

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
export interface QiDropTableOptions extends DropTableQueryOptions, QueryRawOptions { }

/** Options accepted by {@link AbstractQueryInterface#dropAllTables} */
export interface QiDropAllTablesOptions extends QiDropTableOptions {
  skip?: string[];
}

export interface FetchDatabaseVersionOptions extends Omit<QueryRawOptions, 'type' | 'plain'> {}

/** Options accepted by {@link AbstractQueryInterface#removeColumn} */
export interface RemoveColumnOptions extends RemoveColumnQueryOptions, QueryRawOptions { }

/** Options accepted by {@link AbstractQueryInterface#addConstraint} */
export type AddConstraintOptions = AddConstraintQueryOptions & QueryRawOptions;

/** Options accepted by {@link AbstractQueryInterface#deferConstraints} */
export interface DeferConstraintsOptions extends QueryRawOptions { }

/** Options accepted by {@link AbstractQueryInterface#removeConstraint} */
export interface RemoveConstraintOptions extends RemoveConstraintQueryOptions, QueryRawOptions { }

/** Options accepted by {@link AbstractQueryInterface#showConstraints} */
export interface ShowConstraintsOptions extends ShowConstraintsQueryOptions, QueryRawOptions { }
