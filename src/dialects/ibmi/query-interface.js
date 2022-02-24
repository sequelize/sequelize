'use strict';

const { Transaction } = require('../../transaction');
const { QueryInterface } = require('../abstract/query-interface');

/**
 Returns an object that enables the `ibmi` dialect to call underlying odbc
 transaction functions through the connection methods instead

 @class QueryInterface
 @static
 @private
 */

class IBMiQueryInterface extends QueryInterface {

  startTransaction(transaction, options) {
    if (!(transaction instanceof Transaction)) {
      throw new TypeError('Unable to start a transaction without transaction object!');
    }

    options = { ...options, transaction: transaction.parent || transaction };

    options.transaction.name = transaction.parent ? transaction.name : undefined;

    return transaction.connection.beginTransaction();
  }

  commitTransaction(transaction) {
    if (!(transaction instanceof Transaction)) {
      throw new TypeError('Unable to commit a transaction without transaction object!');
    }

    if (transaction.parent) {
      throw new Error('Unable to commit a transaction that has a parent transaction!');
    }

    const promise = transaction.connection.commit();
    transaction.finished = 'commit';

    return promise;
  }

  rollbackTransaction(transaction, options) {
    if (!(transaction instanceof Transaction)) {
      throw new TypeError('Unable to rollback a transaction without transaction object!');
    }

    options = {
      ...options,
      transaction: transaction.parent || transaction,
      supportsSearchPath: false,
      completesTransaction: true,
    };
    options.transaction.name = transaction.parent ? transaction.name : undefined;

    const promise = transaction.connection.rollback();
    transaction.finished = 'commit';

    return promise;
  }
}

exports.IBMiQueryInterface = IBMiQueryInterface;
