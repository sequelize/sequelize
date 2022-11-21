import { randomUUID } from 'node:crypto';
import type { QueryRawOptions } from '../../../sequelize';
import type { ISOLATION_LEVELS, Transaction, TRANSACTION_TYPES } from '../../../transaction';

type SetIsolationLevelQueryOptions = QueryRawOptions & {
  parent?: Transaction['parent'],
};

type DeferConstraintsQueryOptions = {
  transaction?: Transaction,
};

export const TransactionQueries = {
  /**
   * Returns a query that sets the transaction isolation level.
   *
   * @param  value   The isolation level.
   * @param  options An object with options.
   * @returns        The generated sql query.
   * @private
   */
  setIsolationLevelQuery(value: ISOLATION_LEVELS, options: SetIsolationLevelQueryOptions): string {
    if (options.parent) {
      // !FIXME: this originally returned void, is this also okay?
      return '';
    }

    return `SET TRANSACTION ISOLATION LEVEL ${value};`;
  },

  generateTransactionId() {
    return randomUUID();
  },

  /**
   * Returns a query that starts a transaction.
   *
   * @param   transaction
   * @returns             The generated sql query.
   * @private
   */
  startTransactionQuery(transaction: Transaction) {
    if (transaction.parent) {
      // force quoting of savepoint identifiers for postgres/snowflake
      // !FIXME: this.quoteIdentifier is part of AbstractQueryGeneratorTypeScript
      return `SAVEPOINT ${this.quoteIdentifier(transaction.name, true)};`;
    }

    return 'START TRANSACTION;';
  },

  deferConstraintsQuery(_options: DeferConstraintsQueryOptions): string {
    // !FIXME: this.dialect is part of AbstractQueryGeneratorTypeScript
    throw new Error(`deferConstraintsQuery has not been implemented in ${this.dialect.name}.`);
  },

  setConstraintQuery(_columns: string[], _type: TRANSACTION_TYPES): string {
    // !FIXME: this.dialect is part of AbstractQueryGeneratorTypeScript
    throw new Error(`setConstraintQuery has not been implemented in ${this.dialect.name}.`);
  },

  setDeferredQuery(_columns: string[]): string {
    // !FIXME: this.dialect is part of AbstractQueryGeneratorTypeScript
    throw new Error(`setDeferredQuery has not been implemented in ${this.dialect.name}.`);
  },

  setImmediateQuery(_columns: string[]): string {
    // !FIXME: this.dialect is part of AbstractQueryGeneratorTypeScript
    throw new Error(`setImmediateQuery has not been implemented in ${this.dialect.name}.`);
  },

  /**
   * Returns a query that commits a transaction.
   *
   * @param   transaction An object with options.
   * @returns             The generated sql query.
   * @private
   */
  commitTransactionQuery(transaction: Transaction) {
    if (transaction.parent) {
      // !FIXME: this originally returned void, is this also okay?
      return '';
    }

    return 'COMMIT;';
  },

  /**
   * Returns a query that rollbacks a transaction.
   *
   * @param   transaction
   * @returns              The generated sql query.
   * @private
   */
  rollbackTransactionQuery(transaction: Transaction): string {
    if (transaction.parent) {
      // force quoting of savepoint identifiers for postgres/snowflake
      // !FIXME: this.quoteIdentifier is part of AbstractQueryGeneratorTypeScript
      return `ROLLBACK TO SAVEPOINT ${this.quoteIdentifier(transaction.name, true)};`;
    }

    return 'ROLLBACK;';
  },
};
