import type { MssqlDialect } from '.';
import { Transaction } from '../../transaction';
import { rejectInvalidOptions } from '../../utils/check';
import { START_TRANSACTION_QUERY_SUPPORTABLE_OPTIONS } from '../abstract/query-generator-typescript';
import { AbstractQueryInterface } from '../abstract/query-interface';
import type {
  CommitTransactionOptions,
  CreateSavepointOptions,
  RollbackSavepointOptions,
  RollbackTransactionOptions,
  StartTransactionOptions,
} from '../abstract/query-interface.types';
import type { MsSqlConnection } from './connection-manager';
import { MsSqlQueryInterfaceInternal } from './query-interface-internal';

export class MsSqlQueryInterfaceTypescript<
  Dialect extends MssqlDialect = MssqlDialect,
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
    await connection.queue.enqueue(
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
    await connection.queue.enqueue(
      async () =>
        new Promise<void>((resolve, reject) => {
          connection.saveTransaction(
            error => (error ? reject(error) : resolve()),
            // @ts-expect-error -- TODO: remove this when tedious types are fixed
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
    await connection.queue.enqueue(
      async () =>
        new Promise<void>((resolve, reject) => {
          connection.rollbackTransaction(
            error => (error ? reject(error) : resolve()),
            // @ts-expect-error -- TODO: remove this when tedious types are fixed
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
    await connection.queue.enqueue(
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
    await connection.queue.enqueue(
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
}
