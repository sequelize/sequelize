import type { QueryRawOptions } from 'src';
import { PostgresQueryInterface } from '../postgres/query-interface';

export class CockroachDbQueryInterface extends PostgresQueryInterface {
  async dropSchema(schema: string, options: QueryRawOptions) {
    if (schema === 'crdb_internal') {
      return;
    }

    await super.dropSchema(schema, options);
  }

  async removeConstraint(tableName: string, constraintName: string, options: QueryRawOptions): Promise<any> {
    try {
      await super.removeConstraint(tableName, constraintName, options);
    } catch (error: any) {
      if (error.message.includes('use DROP INDEX CASCADE instead')) {
        const query = this.queryGenerator.removeConstraintQuery(
          tableName,
          constraintName,
        );
        const [, queryConstraintName] = query.split('DROP CONSTRAINT');
        const newQuery = `DROP INDEX ${queryConstraintName} CASCADE;`;

        return this.sequelize.query(newQuery, options);
      }

      throw error;
    }
  }
}
