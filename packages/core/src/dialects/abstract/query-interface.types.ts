import type { QueryRawOptions } from '../../sequelize';
import type { CreateSchemaQueryOptions, ListSchemasQueryOptions } from './query-generator';
import type {
  AddConstraintQueryOptions,
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
  constrainCatalog?: string;
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
  constrainCatalog?: string;
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
  isDeferrable?: string;
  initiallyDeferred?: string;
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

export interface FetchDatabaseVersionOptions extends Omit<QueryRawOptions, 'type' | 'plain'> {}

/** Options accepted by {@link AbstractQueryInterface#addConstraint} */
export type AddConstraintOptions = AddConstraintQueryOptions & QueryRawOptions;

/** Options accepted by {@link AbstractQueryInterface#deferConstraints} */
export interface DeferConstraintsOptions extends QueryRawOptions { }

/** Options accepted by {@link AbstractQueryInterface#removeConstraint} */
export interface RemoveConstraintOptions extends RemoveConstraintQueryOptions, QueryRawOptions { }

/** Options accepted by {@link AbstractQueryInterface#showConstraints} */
export interface ShowConstraintsOptions extends ShowConstraintsQueryOptions, QueryRawOptions { }
