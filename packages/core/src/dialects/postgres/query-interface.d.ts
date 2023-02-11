import type { Nullish } from 'src/utils/types.js';
import type { QueryRawOptions, Sequelize } from '../../sequelize.js';
import { AbstractQueryInterface } from '../abstract/query-interface.js';
import type { PostgresQueryGenerator } from './query-generator.js';

export type SchemaOption = {
  // specify the schema to get the tables from
  schema?: string,
};

type ShowAllTablesOptions = Nullish<QueryRawOptions & SchemaOption>;

export class PostgresQueryInterface extends AbstractQueryInterface {
  queryGenerator: PostgresQueryGenerator;

  constructor(sequelize: Sequelize, queryGenerator: PostgresQueryGenerator);

  showAllTables(options?: ShowAllTablesOptions): Promise<string[]>;
}
