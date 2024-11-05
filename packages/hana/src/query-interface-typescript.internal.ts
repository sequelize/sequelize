import {
  AbstractQueryInterface,
  CommitTransactionOptions,
  CreateTableAttributes,
  CreationAttributes,
  Model,
  QueryInterfaceCreateTableOptions,
  RollbackTransactionOptions,
  StartTransactionOptions,
  TableName,
  Transaction,
  QiDropTableOptions
} from '@sequelize/core';
import { AbstractQueryInterfaceInternal } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/query-interface-internal.js';
import type { HanaDialect } from './dialect.js';
import { HanaConnection } from './connection-manager.js';
import { promisify } from 'node:util';

export class HanaQueryInterfaceTypescript<
  Dialect extends HanaDialect = HanaDialect,
> extends AbstractQueryInterface<Dialect> {
  readonly #internalQueryInterface: AbstractQueryInterfaceInternal;

  constructor(dialect: Dialect, internalQueryInterface?: AbstractQueryInterfaceInternal) {
    internalQueryInterface ??= new AbstractQueryInterfaceInternal(dialect);

    super(dialect, internalQueryInterface);
    this.#internalQueryInterface = internalQueryInterface;
  }

  async createTable<M extends Model>(
    tableName: TableName,
    attributes: CreateTableAttributes<M, CreationAttributes<M>>,
    options?: QueryInterfaceCreateTableOptions,
  ): Promise<void> {
    const tableExists = await this.tableExists(tableName, options);
    if (!tableExists) {
      return super.createTable(tableName, attributes, options);
    }
  };

  async _startTransaction(
    transaction: Transaction,
    options: StartTransactionOptions,
  ): Promise<void> {
    if (!transaction || !(transaction instanceof Transaction)) {
      throw new Error('Unable to start a transaction without transaction object!');
    }

    // options = { ...options, transaction: transaction.parent || transaction };
    // options.transaction.name = transaction.parent ? transaction.name : undefined;
//     const sql = this.queryGenerator.startTransactionQuery(options);
    console.log('_startTransaction options', options)
//     console.log('_startTransaction sql', sql)

    const connection = transaction.getConnection() as HanaConnection;
    connection.setAutoCommit(false);

//     await this.sequelize.queryRaw(sql, options);
  }

  async _commitTransaction(
    transaction: Transaction,
    options: CommitTransactionOptions,
  ): Promise<void> {
    if (!transaction || !(transaction instanceof Transaction)) {
      throw new Error('Unable to commit a transaction without the transaction object.');
    }

    const connection = transaction.getConnection() as HanaConnection;
    const commit = promisify(connection.commit.bind(connection));
    await commit();
    connection.setAutoCommit(true);

    // return result;
  }

  async _rollbackTransaction(
    transaction: Transaction,
    options: RollbackTransactionOptions,
  ): Promise<void> {
    if (!transaction || !(transaction instanceof Transaction)) {
      throw new Error('Unable to rollback a transaction without transaction object!');
    }

    // options = {
    //   ...options,
    //   transaction: transaction.parent || transaction,
    //   supportsSearchPath: false,
    //   completesTransaction: true,
    // };
    // options.transaction.name = transaction.parent ? transaction.name : undefined;
//     const sql = this.queryGenerator.rollbackTransactionQuery();
    console.log('_rollbackTransaction options', options)
//     console.log('_rollbackTransaction sql', sql)
//     const promise = this.sequelize.queryRaw(sql && 'ROLLBACK', options);

    // transaction.finished = 'rollback';
//     const result = await promise;

    const connection = transaction.getConnection() as HanaConnection;
    const rollback = promisify(connection.rollback.bind(connection));
    await rollback();
    connection.setAutoCommit(true);

    // return result;
  }

//   async fetchDatabaseVersion(options?: FetchDatabaseVersionOptions): Promise<string> {
//     const payload = await this.#internalQueryInterface.fetchDatabaseVersionRaw<{
//       server_version: string;
//     }>(options);
//
//     return payload.server_version;
//   }
}
