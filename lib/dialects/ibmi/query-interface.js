'use strict';

const Transaction = require('../../transaction');

/**
 Returns an object that enables the `ibmi` dialect to call underlying odbc
 transaction functions through the connection methods instead 

 @class QueryInterface
 @static
 @private
 */

const startTransaction = (transaction, options) => {
  if (!transaction || !(transaction instanceof Transaction)) {
    throw new Error('Unable to start a transaction without transaction object!');
  }
  options = Object.assign({}, options, {
    transaction: transaction.parent || transaction
  });

  options.transaction.name = transaction.parent ? transaction.name : undefined;
  return transaction.connection.beginTransaction();
};

const commitTransaction = transaction => {
  if (!transaction || !(transaction instanceof Transaction)) {
    throw new Error('Unable to commit a transaction without transaction object!');
  }
  if (transaction.parent) {
    // Savepoints cannot be committed
    return Promise.resolve();
  }

  // options = Object.assign({}, options, {
  //   transaction: transaction.parent || transaction,
  //   supportsSearchPath: false,
  //   completesTransaction: true
  // });

  const promise = transaction.connection.commit();
  transaction.finished = 'commit';
  return promise;
};

const rollbackTransaction = (transaction, options) => {
  if (!transaction || !(transaction instanceof Transaction)) {
    throw new Error('Unable to rollback a transaction without transaction object!');
  }

  options = Object.assign({}, options, {
    transaction: transaction.parent || transaction,
    supportsSearchPath: false,
    completesTransaction: true
  });
  options.transaction.name = transaction.parent ? transaction.name : undefined;

  const promise = transaction.connection.rollback();
  transaction.finished = 'commit';

  return promise;
};

module.exports = {
  startTransaction,
  commitTransaction,
  rollbackTransaction
};
