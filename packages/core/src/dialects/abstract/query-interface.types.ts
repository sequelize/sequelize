import type { ReferentialAction } from '../../model';
import type { QueryRawOptions } from '../../sequelize';
import type { CreateSchemaQueryOptions, ListSchemasQueryOptions } from './query-generator';
import type { DeferConstraintsQueryOptions } from './query-generator.types';

export interface ColumnDescription {
  type: string;
  allowNull: boolean;
  defaultValue: string;
  primaryKey: boolean;
  autoIncrement: boolean;
  comment: string | null;
}

export type ColumnsDescription = Record<string, ColumnDescription>;

export interface ConstraintDescription {
  constrainCatalog?: string;
  constraintSchema: string;
  constraintName: string;
  constraintType: 'CHECK' | 'DEFAULT' | 'FOREIGN KEY' | 'PRIMARY KEY' | 'UNIQUE';
  tableCatalog?: string;
  tableSchema: string;
  tableName: string;
  columnNames?: string[];
  referencedTableSchema?: string;
  referencedTableName?: string;
  referencedColumnNames?: string[];
  deleteAction?: ReferentialAction;
  updateAction?: ReferentialAction;
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

/** Options accepted by {@link AbstractQueryInterfaceTypeScript#deferConstraints} */
export interface DeferConstraintsOptions extends DeferConstraintsQueryOptions, QueryRawOptions { }

/** Options accepted by {@link AbstractQueryInterfaceTypeScript#showConstraint} */
export interface ShowConstraintOptions extends QueryRawOptions { }
