import { Transaction } from '../../transaction';
import { rejectInvalidOptions } from '../../utils/check';
import { START_TRANSACTION_QUERY_SUPPORTABLE_OPTIONS } from '../abstract/query-generator-typescript';
import { AbstractQueryInterface } from '../abstract/query-interface';
import type {
  CommitTransactionOptions,
  RollbackTransactionOptions,
  SetIsolationLevelOptions,
  StartTransactionOptions,
} from '../abstract/query-interface.types';
import type { IBMiConnection } from './connection-manager';
import type { IBMiDialect } from './index.js';
import { IBMiQueryInterfaceInternal } from './query-interface-internal.js';

export class IBMiQueryInterface<
  Dialect extends IBMiDialect = IBMiDialect,
> extends AbstractQueryInterface<Dialect> {
  readonly #internalQueryInterface: IBMiQueryInterfaceInternal;

  constructor(dialect: Dialect, internalQueryInterface?: IBMiQueryInterfaceInternal) {
    internalQueryInterface ??= new IBMiQueryInterfaceInternal(dialect);

    super(dialect, internalQueryInterface);
    this.#internalQueryInterface = internalQueryInterface;
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

    const connection = transaction.getConnection() as IBMiConnection;
    await connection.beginTransaction();
    if (options.isolationLevel) {
      await transaction.setIsolationLevel(options.isolationLevel);
    }
  }

  async _commitTransaction(
    transaction: Transaction,
    _options: CommitTransactionOptions,
  ): Promise<void> {
    if (!transaction || !(transaction instanceof Transaction)) {
      throw new Error('Unable to commit a transaction without the transaction object.');
    }

    const connection = transaction.getConnection() as IBMiConnection;
    await connection.commit();
  }

  async _rollbackTransaction(
    transaction: Transaction,
    _options: RollbackTransactionOptions,
  ): Promise<void> {
    if (!transaction || !(transaction instanceof Transaction)) {
      throw new Error('Unable to rollback a transaction without the transaction object.');
    }

    const connection = transaction.getConnection() as IBMiConnection;
    await connection.rollback();
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
    const connection = transaction.getConnection() as IBMiConnection;
    await connection.setIsolationLevel(level);
  }
}
