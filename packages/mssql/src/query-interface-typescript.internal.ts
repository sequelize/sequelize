import type {
  CommitTransactionOptions,
  CreateSavepointOptions,
  RollbackSavepointOptions,
  RollbackTransactionOptions,
  ShowTemporalPeriodsOptions,
  ShowTemporalTablesOptions,
  StartTransactionOptions,
} from '@sequelize/core';
import {
  AbstractQueryInterface,
  HistoryRetentionPeriodUnit,
  QueryTypes,
  TemporalPeriodType,
  TemporalTableType,
  Transaction,
} from '@sequelize/core';
import { START_TRANSACTION_QUERY_SUPPORTABLE_OPTIONS } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/query-generator-typescript.js';
import type {
  TemporalPeriodDefinition,
  TemporalTableDefinition,
} from '@sequelize/core/_non-semver-use-at-your-own-risk_/temporal-tables.js';
import { rejectInvalidOptions } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/check.js';
import { ASYNC_QUEUE } from './_internal/symbols.js';
import type { MsSqlConnection } from './connection-manager.js';
import type { MsSqlDialect } from './dialect.js';
import { MsSqlQueryInterfaceInternal } from './query-interface.internal.js';

export class MsSqlQueryInterfaceTypescript<
  Dialect extends MsSqlDialect = MsSqlDialect,
> extends AbstractQueryInterface<Dialect> {
  readonly #internalQueryInterface: MsSqlQueryInterfaceInternal;

  constructor(dialect: Dialect, internalQueryInterface?: MsSqlQueryInterfaceInternal) {
    internalQueryInterface ??= new MsSqlQueryInterfaceInternal(dialect);

    super(dialect, internalQueryInterface);
    this.#internalQueryInterface = internalQueryInterface;
  }

  async _commitTransaction(
    transaction: Transaction,
    _options: CommitTransactionOptions,
  ): Promise<void> {
    if (!transaction || !(transaction instanceof Transaction)) {
      throw new Error('Unable to commit a transaction without the transaction object.');
    }

    const connection = transaction.getConnection() as MsSqlConnection;
    await connection[ASYNC_QUEUE].enqueue(
      async () =>
        new Promise<void>((resolve, reject) => {
          connection.commitTransaction(error => (error ? reject(error) : resolve()));
        }),
    );
  }

  async _createSavepoint(transaction: Transaction, options: CreateSavepointOptions): Promise<void> {
    if (!transaction || !(transaction instanceof Transaction)) {
      throw new Error('Unable to create a savepoint without the transaction object.');
    }

    const connection = transaction.getConnection() as MsSqlConnection;
    await connection[ASYNC_QUEUE].enqueue(
      async () =>
        new Promise<void>((resolve, reject) => {
          connection.saveTransaction(
            error => (error ? reject(error) : resolve()),
            options.savepointName,
          );
        }),
    );
  }

  async _rollbackSavepoint(
    transaction: Transaction,
    options: RollbackSavepointOptions,
  ): Promise<void> {
    if (!transaction || !(transaction instanceof Transaction)) {
      throw new Error('Unable to rollback a savepoint without the transaction object.');
    }

    const connection = transaction.getConnection() as MsSqlConnection;
    await connection[ASYNC_QUEUE].enqueue(
      async () =>
        new Promise<void>((resolve, reject) => {
          connection.rollbackTransaction(
            error => (error ? reject(error) : resolve()),
            options.savepointName,
          );
        }),
    );
  }

  async _rollbackTransaction(
    transaction: Transaction,
    _options: RollbackTransactionOptions,
  ): Promise<void> {
    if (!transaction || !(transaction instanceof Transaction)) {
      throw new Error('Unable to rollback a transaction without the transaction object.');
    }

    const connection = transaction.getConnection() as MsSqlConnection;
    await connection[ASYNC_QUEUE].enqueue(
      async () =>
        new Promise<void>((resolve, reject) => {
          connection.rollbackTransaction(error => (error ? reject(error) : resolve()));
        }),
    );
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

    const connection = transaction.getConnection() as MsSqlConnection;
    await connection[ASYNC_QUEUE].enqueue(
      async () =>
        new Promise<void>((resolve, reject) => {
          connection.beginTransaction(
            error => (error ? reject(error) : resolve()),
            options.transactionName,
            this.#internalQueryInterface.parseIsolationLevel(options.isolationLevel),
          );
        }),
    );
  }

  async showTemporalPeriods(
    options?: ShowTemporalPeriodsOptions,
  ): Promise<TemporalPeriodDefinition[]> {
    const sql = this.queryGenerator.showTemporalPeriodsQuery(options);

    const periods = await this.sequelize.queryRaw<Record<string, string>>(sql, {
      ...options,
      raw: true,
      type: QueryTypes.SELECT,
    });

    const periodMap = new Map([
      ['SYSTEM_TIME_PERIOD', TemporalPeriodType.SYSTEM],
      ['APPLICATION_TIME_PERIOD', TemporalPeriodType.APPLICATION],
    ]);

    return periods.map(p => {
      const periodType = periodMap.get(p.type);
      if (!periodType) {
        throw new Error(`Unknown period type ${p.type}`);
      }

      return {
        name: p.name,
        rowEnd: p.rowEnd,
        rowStart: p.rowStart,
        type: periodType,
      };
    });
  }

  async showTemporalTables(
    options?: ShowTemporalTablesOptions,
  ): Promise<TemporalTableDefinition[]> {
    const sql = this.queryGenerator.showTemporalTablesQuery(options);

    const tables = await this.sequelize.queryRaw<Record<string, string>>(sql, {
      ...options,
      raw: true,
      type: QueryTypes.SELECT,
    });

    const tableMap = new Map([
      ['SYSTEM_VERSIONED_TEMPORAL_TABLE', TemporalTableType.SYSTEM_PERIOD],
    ]);

    return tables.map(t => {
      const tableType = tableMap.get(t.type);
      if (!tableType) {
        throw new Error(`Unknown table type ${t.type}`);
      }

      const data: TemporalTableDefinition = {
        tableName: t.tableName,
        schema: t.schema,
        temporalTableType: tableType,
      };

      if (this.dialect.supports.temporalTables.historyTable) {
        data.historyTable = { tableName: t.historyTableName, schema: t.historySchema };
      }

      if (this.dialect.supports.temporalTables.historyRetentionPeriod) {
        const length = t.historyRetentionPeriodLength
          ? Number.parseInt(t.historyRetentionPeriodLength, 10)
          : null;
        const unit =
          (t.historyRetentionPeriodUnit as HistoryRetentionPeriodUnit) ||
          HistoryRetentionPeriodUnit.INFINITE;
        data.historyRetentionPeriod = { length, unit };
      }

      return data;
    });
  }
}
