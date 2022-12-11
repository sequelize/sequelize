import type { QueryRawOptions, Sequelize } from 'src/sequelize';
import type { AbstractQueryGenerator, CreateSchemaQueryOptions } from './query-generator';

export interface QueryInterfaceOptions {
  sequelize: Sequelize;
  queryGenerator: AbstractQueryGenerator;
}

export interface CreateSchemaOptions extends CreateSchemaQueryOptions, QueryRawOptions {}

