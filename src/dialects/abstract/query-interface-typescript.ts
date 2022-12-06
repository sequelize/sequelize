import type { QueryRawOptions, Sequelize } from '../../sequelize';
import type { AbstractQueryGenerator } from './query-generator';

export interface QueryInterfaceOptions {
  sequelize: Sequelize;
  queryGenerator: AbstractQueryGenerator;
}

export class AbstractQueryInterfaceTypeScript {
  readonly sequelize: Sequelize;
  readonly queryGenerator: AbstractQueryGenerator;

  constructor(options: QueryInterfaceOptions) {
    this.sequelize = options.sequelize;
    this.queryGenerator = options.queryGenerator;
  }

  /**
   * Queries the schema (table list).
   *
   * @param schema The schema to query. Applies only to Postgres.
   * @param options
   */
  async createSchema(schema: string, options?: QueryRawOptions): Promise<void> {
    const sql = this.queryGenerator.createSchemaQuery(schema);
    await this.sequelize.queryRaw(sql, options);
  }
}
