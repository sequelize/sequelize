import type { QueryRawOptions, Sequelize } from '../../sequelize.js';
import { AbstractQueryInterface } from '../abstract/query-interface.js';
import type { PostgresQueryGenerator } from './query-generator.js';

export type SchemaOption = {
  // specify the schema to get the tables from
  schema?: string,
};

export interface QueryRawOptionsWithSchema extends QueryRawOptions {
  schema?: string;
}

export class PostgresQueryInterface extends AbstractQueryInterface {
  queryGenerator: PostgresQueryGenerator;

  constructor(sequelize: Sequelize, queryGenerator: PostgresQueryGenerator);

  showAllTables(options?: QueryRawOptionsWithSchema): Promise<string[]>;
}
