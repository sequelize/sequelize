import type { QueryRawOptions, Sequelize } from '../../sequelize';
import type { AbstractQueryGenerator } from './query-generator';

export interface QueryInterfaceOptions {
  sequelize: Sequelize;
  queryGenerator: AbstractQueryGenerator;
}

export class AbstractQueryInterfaceTypeScript {
  protected readonly sequelize: Sequelize;
  protected readonly queryGenerator: AbstractQueryGenerator;

  constructor(options: QueryInterfaceOptions) {
    if (!options.sequelize) {
      throw new Error('QueryInterface initialized without options.sequelize');
    }

    if (!options.queryGenerator) {
      throw new Error('QueryInterface initialized without options.queryGenerator');
    }

    this.sequelize = options.sequelize;
    this.queryGenerator = options.queryGenerator;
  }

  async createSchema(schema: string, options?: QueryRawOptions): Promise<void> {
    if (schema == null) {
      throw new Error('Cannot create a schema without passing a schema name');
    }

    const sql = this.queryGenerator.createSchemaQuery(schema);
    await this.sequelize.queryRaw(sql, options);
  }
}
