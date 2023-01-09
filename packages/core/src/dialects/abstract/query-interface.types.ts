import type { QueryRawOptions, Sequelize } from '../../sequelize';
import type { AbstractQueryGenerator, CreateSchemaQueryOptions, ListSchemasQueryOptions } from './query-generator';
import type { CollateCharsetOptions } from './query-interface';

export interface QueryInterfaceOptions {
  sequelize: Sequelize;
  queryGenerator: AbstractQueryGenerator;
}

export interface CreateDatabaseOptions extends CollateCharsetOptions, QueryRawOptions {
  encoding?: string;
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
