import type { QueryRawOptions, RemoveConstraintOptions } from '../../index';
import type { TableNameOrModel } from '../abstract/query-generator-typescript';
import { PostgresQueryInterface } from '../postgres/query-interface';

export class CockroachDbQueryInterface extends PostgresQueryInterface {
  async dropSchema(schema: string, options: QueryRawOptions) {
    if (schema === 'crdb_internal') {
      throw new Error('Cannot remove crdb_internal schema in Cockroachdb');
    }

    await super.dropSchema(schema, options);
  }

  // CockroachDB support dropping constraints like Postgres unless the constraint is being referenced by a partial index predicate.
  // In such cases only DROP index is to be used https://github.com/cockroachdb/cockroach/issues/97813
  async removeConstraint(
    tableName: TableNameOrModel,
    constraintName: string,
    options: RemoveConstraintOptions,
  ): Promise<any> {
    try {
      await super.removeConstraint(tableName, constraintName, options);
    } catch (error: any) {
      if (error.message.includes('use DROP INDEX CASCADE instead')) {
        const query = this.queryGenerator.removeConstraintQuery(
          tableName,
          constraintName,
        );
        const [, queryConstraintName] = query.split('DROP CONSTRAINT');
        const tableDetails = this.queryGenerator.extractTableDetails(tableName);
        let newQuery;

        if (tableDetails?.schema && tableDetails?.tableName) {
          newQuery = `DROP INDEX ${tableDetails.schema}.${tableDetails.tableName}@${queryConstraintName.trim()} CASCADE`;
        } else {
          newQuery = `DROP INDEX ${queryConstraintName} CASCADE;`;
        }

        return this.sequelize.query(newQuery, options);
      }

      throw error;
    }
  }
}
