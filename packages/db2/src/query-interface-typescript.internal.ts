import type {
  CommitTransactionOptions,
  QiDropAllSchemasOptions,
  RollbackTransactionOptions,
  SetIsolationLevelOptions,
  StartTransactionOptions,
} from '@sequelize/core';
import { AbstractQueryInterface, QueryTypes, Transaction } from '@sequelize/core';
import { START_TRANSACTION_QUERY_SUPPORTABLE_OPTIONS } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/query-generator-typescript.js';
import { rejectInvalidOptions } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/check.js';
import type { Db2Connection } from './connection-manager.js';
import type { Db2Dialect } from './dialect.js';
import { Db2QueryInterfaceInternal } from './query-interface.internal.js';

export class Db2QueryInterfaceTypeScript<
  Dialect extends Db2Dialect = Db2Dialect,
> extends AbstractQueryInterface<Dialect> {
  readonly #internalQueryInterface: Db2QueryInterfaceInternal;

  constructor(dialect: Dialect, internalQueryInterface?: Db2QueryInterfaceInternal) {
    internalQueryInterface ??= new Db2QueryInterfaceInternal(dialect);

    super(dialect, internalQueryInterface);
    this.#internalQueryInterface = internalQueryInterface;
  }

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
        const routines = await this.sequelize.queryRaw<{
          ROUTINENAME: string;
          ROUTINETYPE: 'F' | 'M' | 'P';
        }>(
          `SELECT ROUTINENAME, ROUTINETYPE FROM SYSCAT.ROUTINES WHERE ROUTINESCHEMA = ${this.queryGenerator.escape(schema)}`,
          {
            ...options,
            type: QueryTypes.SELECT,
          },
        );
        for (const routine of routines) {
          const type =
            routine.ROUTINETYPE === 'F'
              ? 'FUNCTION'
              : routine.ROUTINETYPE === 'P'
                ? 'PROCEDURE'
                : routine.ROUTINETYPE === 'M'
                  ? 'METHOD'
                  : '';
          // eslint-disable-next-line no-await-in-loop
          await this.sequelize.queryRaw(
            `DROP ${type} ${this.quoteIdentifier(schema)}.${this.quoteIdentifier(routine.ROUTINENAME)}`,
            options,
          );
        }

        // In Db2 the triggers are scoped to the schema, so we need to drop them separately for each schema
        // eslint-disable-next-line no-await-in-loop
        const triggers = await this.sequelize.queryRaw<{ TRIGNAME: string }>(
          `SELECT TRIGNAME FROM SYSCAT.TRIGGERS WHERE TRIGSCHEMA = ${this.queryGenerator.escape(schema)}`,
          {
            ...options,
            type: QueryTypes.SELECT,
          },
        );
        for (const trigger of triggers) {
          // eslint-disable-next-line no-await-in-loop
          await this.sequelize.queryRaw(
            `DROP TRIGGER ${this.quoteIdentifier(schema)}.${this.quoteIdentifier(trigger.TRIGNAME)}`,
            options,
          );
        }
      }
    }

    // Drop all the schemas in a loop to avoid deadlocks and timeouts
    for (const schema of schemaNames) {
      // eslint-disable-next-line no-await-in-loop
      await this.dropSchema(schema, options);
    }
  }

  async _commitTransaction(
    transaction: Transaction,
    _options: CommitTransactionOptions,
  ): Promise<void> {
    if (!transaction || !(transaction instanceof Transaction)) {
      throw new Error('Unable to commit a transaction without the transaction object.');
    }

    const connection = transaction.getConnection() as Db2Connection;
    await connection.commitTransaction();
  }

  async _rollbackTransaction(
    transaction: Transaction,
    _options: RollbackTransactionOptions,
  ): Promise<void> {
    if (!transaction || !(transaction instanceof Transaction)) {
      throw new Error('Unable to rollback a transaction without the transaction object.');
    }

    const connection = transaction.getConnection() as Db2Connection;
    await connection.rollbackTransaction();
  }

  async _setIsolationLevel(
    transaction: Transaction,
    options: SetIsolationLevelOptions,
  ): Promise<void> {
    if (!transaction || !(transaction instanceof Transaction)) {
      throw new Error(
        'Unable to set the isolation level for a transaction without the transaction object.',
      );
    }

    const level = this.#internalQueryInterface.parseIsolationLevel(options.isolationLevel);
    const connection = transaction.getConnection() as Db2Connection;
    connection.setIsolationLevel(level);
  }

  async _startTransaction(
    transaction: Transaction,
    options: StartTransactionOptions,
  ): Promise<void> {
    if (!transaction || !(transaction instanceof Transaction)) {
      throw new Error('Unable to start a transaction without the transaction object.');
    }

    if (options) {
      rejectInvalidOptions(
        'startTransactionQuery',
        this.sequelize.dialect,
        START_TRANSACTION_QUERY_SUPPORTABLE_OPTIONS,
        this.sequelize.dialect.supports.startTransaction,
        options,
      );
    }

    const connection = transaction.getConnection() as Db2Connection;
    await connection.beginTransaction();
    if (options.isolationLevel) {
      await transaction.setIsolationLevel(options.isolationLevel);
    }
  }
}
