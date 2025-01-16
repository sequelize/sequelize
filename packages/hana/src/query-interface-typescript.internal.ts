import type {
  CommitTransactionOptions,
  RollbackTransactionOptions,
  StartTransactionOptions,
} from '@sequelize/core';
import {
  AbstractQueryInterface,
  Transaction,
} from '@sequelize/core';
import { AbstractQueryInterfaceInternal } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/query-interface-internal.js';
import { promisify } from 'node:util';
import type { HanaConnection } from './connection-manager.js';
import type { HanaDialect } from './dialect.js';

export class HanaQueryInterfaceTypescript<
  Dialect extends HanaDialect = HanaDialect,
> extends AbstractQueryInterface<Dialect> {
  readonly #internalQueryInterface: AbstractQueryInterfaceInternal;

  constructor(dialect: Dialect, internalQueryInterface?: AbstractQueryInterfaceInternal) {
    internalQueryInterface ??= new AbstractQueryInterfaceInternal(dialect);

    super(dialect, internalQueryInterface);
    this.#internalQueryInterface = internalQueryInterface;
  }

  async _startTransaction(
    transaction: Transaction,
    options: StartTransactionOptions,
  ): Promise<void> {
    if (!transaction || !(transaction instanceof Transaction)) {
      throw new Error('Unable to start a transaction without transaction object!');
    }

    const queryOptions = { ...options, transaction, supportsSearchPath: false };

    const connection = transaction.getConnection() as HanaConnection;
    connection.setAutoCommit(false);

    if (queryOptions.isolationLevel) {
      await transaction.setIsolationLevel(queryOptions.isolationLevel);
    }
  }

  async _commitTransaction(
    transaction: Transaction,
    _options: CommitTransactionOptions,
  ): Promise<void> {
    if (!transaction || !(transaction instanceof Transaction)) {
      throw new Error('Unable to commit a transaction without the transaction object.');
    }

    const connection = transaction.getConnection() as HanaConnection;
    const commit = promisify(connection.commit.bind(connection));
    try {
      await commit();
    } finally {
      connection.setAutoCommit(true);
    }
  }

  async _rollbackTransaction(
    transaction: Transaction,
    _options: RollbackTransactionOptions,
  ): Promise<void> {
    if (!transaction || !(transaction instanceof Transaction)) {
      throw new Error('Unable to rollback a transaction without transaction object!');
    }

    const connection = transaction.getConnection() as HanaConnection;
    const rollback = promisify(connection.rollback.bind(connection));
    try {
      await rollback();
    } finally {
      connection.setAutoCommit(true);
    }
  }
}
