import type { QueryRawOptions, Sequelize } from '../../sequelize';
import type { AbstractQueryGenerator, CreateSchemaQueryOptions, ListSchemasQueryOptions } from './query-generator';

export interface QueryInterfaceOptions {
  sequelize: Sequelize;
  queryGenerator: AbstractQueryGenerator;
}

/** Options accepted by {@link AbstractQueryInterfaceTypeScript#createSchema} */
export interface CreateSchemaOptions extends CreateSchemaQueryOptions, QueryRawOptions { }

/** Options accepted by {@link AbstractQueryInterfaceTypeScript#showAllSchemas} */
export interface ShowAllSchemasOptions extends ListSchemasQueryOptions, QueryRawOptions { }

/** Options accepted by {@link AbstractQueryInterfaceTypeScript#dropAllSchemas} */
export interface DropAllSchemasOptions extends QueryRawOptions {
  /**
   * List of schemas to skip dropping (i.e., list of schemas to keep)
   */
  skip?: string[];
}

/** Options accepted by {@link AbstractQueryInterfaceTypeScript#describeTable} */
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
