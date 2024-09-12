'use strict';

const uuidv4 = require('uuid').v4;

const TransactionQueries = {
  /**
   * Returns a query that sets the transaction isolation level.
   *
   * @param  {string} value   The isolation level.
   * @param  {object} options An object with options.
   * @returns {string}         The generated sql query.
   * @private
   */
  setIsolationLevelQuery(value, options) {
    if (options.parent) {
      return;
    }

    return `SET TRANSACTION ISOLATION LEVEL ${value};`;
  },

  generateTransactionId() {
    return uuidv4();
  },

  /**
   * Returns a query that starts a transaction.
   *
   * @param  {Transaction} transaction
   * @returns {string}         The generated sql query.
   * @private
   */
  startTransactionQuery(transaction) {
    if (transaction.parent) {
      // force quoting of savepoint identifiers for postgres
      return `SAVEPOINT ${this.quoteIdentifier(transaction.name, true)};`;
    }

    return 'START TRANSACTION;';
  },

  deferConstraintsQuery() {},

  setConstraintQuery() {},
  setDeferredQuery() {},
  setImmediateQuery() {},

  /**
   * Returns a query that commits a transaction.
   *
   * @param  {Transaction} transaction An object with options.
   * @returns {string}         The generated sql query.
   * @private
   */
  commitTransactionQuery(transaction) {
    if (transaction.parent) {
      return;
    }

    return 'COMMIT;';
  },

  /**
   * Returns a query that rollbacks a transaction.
   *
   * @param  {Transaction} transaction
   * @returns {string}         The generated sql query.
   * @private
   */
  rollbackTransactionQuery(transaction) {
    if (transaction.parent) {
      // force quoting of savepoint identifiers for postgres
      return `ROLLBACK TO SAVEPOINT ${this.quoteIdentifier(transaction.name, true)};`;
    }

    return 'ROLLBACK;';
  }
};

module.exports = TransactionQueries;
