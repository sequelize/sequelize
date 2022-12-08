import type { Sequelize } from '../../sequelize';
import type { AbstractQueryGenerator, CreateSchemaQueryOptions } from './query-generator';

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
   * Create a new database schema.
   *
   * **Note:** this is a schema in the [postgres sense of the word](http://www.postgresql.org/docs/9.1/static/ddl-schemas.html),
   * not a database table. In mysql and sqlite, this command will do nothing.
   *
   * @param schema
   * @param options
   * @see
   * {@link Model.schema}
   */
  async createSchema(schema: string, options?: CreateSchemaQueryOptions): Promise<void> {
    const sql = this.queryGenerator.createSchemaQuery(schema, options);
    await this.sequelize.queryRaw(sql);
  }
}
