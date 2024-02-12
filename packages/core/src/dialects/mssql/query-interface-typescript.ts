import { Transaction } from '../../transaction';
import { AbstractQueryInterface } from '../abstract/query-interface';
import type { CreateSavepointOptions, RollbackSavepointOptions } from '../abstract/query-interface.types';
import type { MsSqlConnection } from './connection-manager';
import type { MssqlDialect } from '.';

export class MsSqlQueryInterfaceTypescript<Dialect extends MssqlDialect = MssqlDialect>
  extends AbstractQueryInterface<Dialect> {
  async _createSavepoint(transaction: Transaction, options: CreateSavepointOptions): Promise<void> {
    if (!transaction || !(transaction instanceof Transaction)) {
      throw new Error('Unable to create a savepoint without the transaction object.');
    }

    const connection = transaction.getConnection() as MsSqlConnection;
    await connection.queue.enqueue(async () => new Promise<void>((resolve, reject) => {
      // @ts-expect-error -- TODO: remove this when tedious types are fixed
      connection.saveTransaction(error => (error ? reject(error) : resolve()), options.savepointName);
    }));
  }

  async _rollbackSavepoint(transaction: Transaction, options: RollbackSavepointOptions): Promise<void> {
    if (!transaction || !(transaction instanceof Transaction)) {
      throw new Error('Unable to rollback a savepoint without the transaction object.');
    }

    const connection = transaction.getConnection() as MsSqlConnection;
    await connection.queue.enqueue(async () => new Promise<void>((resolve, reject) => {
      // @ts-expect-error -- TODO: remove this when tedious types are fixed
      connection.rollbackTransaction(error => (error ? reject(error) : resolve()), options.savepointName);
    }));
  }
}
