import { AbstractQueryInterface, Transaction } from '@sequelize/core';

export class HanaQueryInterface extends AbstractQueryInterface {
  async startTransaction(transaction, options) {
    if (!transaction || !(transaction instanceof Transaction)) {
      throw new Error('Unable to start a transaction without transaction object!');
    }

    options = { ...options, transaction: transaction.parent || transaction };
    options.transaction.name = transaction.parent ? transaction.name : undefined;
    const sql = this.queryGenerator.startTransactionQuery(transaction);

    const connection = transaction.getConnection();
    connection.setAutoCommit(false);

    return await this.sequelize.queryRaw(sql, options);
  }

  async commitTransaction(transaction, options) {
    if (!transaction || !(transaction instanceof Transaction)) {
      throw new Error('Unable to commit a transaction without transaction object!');
    }

    if (transaction.parent) {
      // Savepoints cannot be committed
      return;
    }

    options = {
      ...options,
      transaction: transaction.parent || transaction,
      supportsSearchPath: false,
      completesTransaction: true,
    };

    const sql = this.queryGenerator.commitTransactionQuery(transaction);
    const promise = this.sequelize.queryRaw(sql, options);

    transaction.finished = 'commit';

    const result = await promise;

    const connection = transaction.getConnection();
    connection.setAutoCommit(true);

    return result;
  }

  async rollbackTransaction(transaction, options) {
    if (!transaction || !(transaction instanceof Transaction)) {
      throw new Error('Unable to rollback a transaction without transaction object!');
    }

    options = {
      ...options,
      transaction: transaction.parent || transaction,
      supportsSearchPath: false,
      completesTransaction: true,
    };
    options.transaction.name = transaction.parent ? transaction.name : undefined;
    const sql = this.queryGenerator.rollbackTransactionQuery(transaction);
    const promise = this.sequelize.queryRaw(sql, options);

    transaction.finished = 'rollback';

    const result = await promise;

    const connection = transaction.getConnection();
    connection.setAutoCommit(true);

    return result;
  }
}
