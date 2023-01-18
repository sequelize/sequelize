import { PostgresQueryInterface } from '../postgres/query-interface';

export class CockroahcDbQueryInterface extends PostgresQueryInterface {
  async dropSchema(schema, options) {
    if (schema === 'crdb_internal') {
      return;
    }

    await super.dropSchema(schema, options);
  }

  async removeConstraint(tableName, constraintName, options) {
    try {
      await super.removeConstraint(tableName, constraintName, options);
    } catch (error) {
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
