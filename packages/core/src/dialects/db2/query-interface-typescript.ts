import { QueryTypes } from '../../query-types';
import { AbstractQueryInterface } from '../abstract/query-interface';
import type { QiDropAllSchemasOptions } from '../abstract/query-interface.types';

export class Db2QueryInterfaceTypeScript extends AbstractQueryInterface {
  async dropAllSchemas(options?: QiDropAllSchemasOptions): Promise<void> {
    const skip = options?.skip || [];
    const allSchemas = await this.listSchemas(options);
    const schemaNames = allSchemas.filter(schemaName => !skip.includes(schemaName));

    // if the dialect does not support "cascade", then drop all tables and routines first in a loop to avoid deadlocks and timeouts
    if (options?.cascade === undefined) {
      for (const schema of schemaNames) {
        // eslint-disable-next-line no-await-in-loop
        await this.dropAllTables({ ...options, schema });

        // In Db2 the routines are scoped to the schema, so we need to drop them separately for each schema
        // eslint-disable-next-line no-await-in-loop
        const routines = await this.sequelize.queryRaw<{ ROUTINENAME: string, ROUTINETYPE: 'F' | 'M' | 'P' }>(`SELECT ROUTINENAME, ROUTINETYPE FROM SYSCAT.ROUTINES WHERE ROUTINESCHEMA = ${this.queryGenerator.escape(schema)}`, {
          ...options,
          type: QueryTypes.SELECT,
        });
        for (const routine of routines) {
          const type = routine.ROUTINETYPE === 'F'
          ? 'FUNCTION'
          : routine.ROUTINETYPE === 'P'
          ? 'PROCEDURE'
          : routine.ROUTINETYPE === 'M'
          ? 'METHOD'
          : '';
          // eslint-disable-next-line no-await-in-loop
          await this.sequelize.queryRaw(`DROP ${type} ${this.quoteIdentifier(schema)}.${this.quoteIdentifier(routine.ROUTINENAME)}`, options);
        }

        // In Db2 the triggers are scoped to the schema, so we need to drop them separately for each schema
        // eslint-disable-next-line no-await-in-loop
        const triggers = await this.sequelize.queryRaw<{ TRIGNAME: string }>(`SELECT TRIGNAME FROM SYSCAT.TRIGGERS WHERE TRIGSCHEMA = ${this.queryGenerator.escape(schema)}`, {
          ...options,
          type: QueryTypes.SELECT,
        });
        for (const trigger of triggers) {
          // eslint-disable-next-line no-await-in-loop
          await this.sequelize.queryRaw(`DROP TRIGGER ${this.quoteIdentifier(schema)}.${this.quoteIdentifier(trigger.TRIGNAME)}`, options);
        }
      }
    }

    // Drop all the schemas in a loop to avoid deadlocks and timeouts
    for (const schema of schemaNames) {
      // eslint-disable-next-line no-await-in-loop
      await this.dropSchema(schema, options);
    }
  }
}
