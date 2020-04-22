'use strict';

const Support = require('../support');

const runningQueries = new Map();
const runningTransactions = new Map(); // map transaction option to queries.

before(function() {
  this.sequelize.addHook('beforeQuery', (options, query, sql) => {
    runningQueries.set(query, options);
    if (options.transaction) {
      const queryList = runningTransactions.get(options.transaction.id);
      if (queryList) {
        queryList.push(sql);
      } else {
        runningTransactions.set(options.transaction.id, [sql]);
      }
    }
  });
  this.sequelize.addHook('afterQuery', (options, query, sql) => {
    runningQueries.delete(query);
    if (options.transaction && sql.includes('COMMIT')) {
      runningTransactions.delete(options.transaction);
    }
  });
});

beforeEach(function() {
  return Support.clearDatabase(this.sequelize);
});

afterEach(function() {
  if (runningQueries.size === 0) {
    return;
  }
  let msg = `Expected 0 running queries. ${runningQueries.size} queries still running in ${this.currentTest.fullTitle()}\n`;
  msg += 'Queries:\n\n     ';
  for (const [query, options] of runningQueries) {
    msg += `${query.uuid}: ${query.sql}\n`;
    if (options.transaction) {
      const relatedTransaction = runningTransactions.get(options.transaction.id);
      if (relatedTransaction) {
        msg += options.transaction.trace;
        msg += 'In transaction:\n\n';
        msg += relatedTransaction.join('\n');
      }
    }
  }
  throw new Error(msg);
});

module.exports = Support;
