/**
 * Not implemented for db2/mssql
 * Test where options.parent, returns nothing
 * Test where value, returns `SET TRANSACTION ISOLATION LEVEL ${value};` for abstract
 */

/**
 * For SQLite;
 *  switch (value) {
 *     case Transaction.ISOLATION_LEVELS.REPEATABLE_READ:
 *       return '-- SQLite is not able to choose the isolation level REPEATABLE READ.';
 *     case Transaction.ISOLATION_LEVELS.READ_UNCOMMITTED:
 *       return 'PRAGMA read_uncommitted = ON;';
 *     case Transaction.ISOLATION_LEVELS.READ_COMMITTED:
 *       return 'PRAGMA read_uncommitted = OFF;';
 *     case Transaction.ISOLATION_LEVELS.SERIALIZABLE:
 *       return '-- SQLite\'s default isolation level is SERIALIZABLE. Nothing to do.';
 *     default:
 *       throw new Error(`Unknown isolation level: ${value}`);
 *   }
 */

import { ISOLATION_LEVELS } from '@sequelize/core/_non-semver-use-at-your-own-risk_/transaction.js';
import { expectsql, sequelize } from '../../../support';

describe.only('QueryGenerator#setIsolationLevelQuery', () => {
  const queryGenerator = sequelize.getQueryInterface().queryGenerator;

  //    it('produces a query used to start a transaction', () => {
  //      // @ts-expect-error - this is not a valid Transaction, but it's enough for this test
  //      expectsql(() => queryGenerator.startTransactionQuery({}), {
  //        default: 'START TRANSACTION;',
  //        'mssql sqlite db2': 'BEGIN TRANSACTION;',
  //        ibmi: 'START TRANSACTION;',
  //      });
  //    });

  //    it('produces a query used to start a transaction with a transaction type', () => {
  //      // @ts-expect-error - this is not a valid Transaction, but it's enough for this test
  //      expectsql(() => queryGenerator.startTransactionQuery({ options: { type: TRANSACTION_TYPES.IMMEDIATE } }), {
  //        default: 'START TRANSACTION;',
  //        'mssql db2': 'BEGIN TRANSACTION;',
  //        sqlite: 'BEGIN IMMEDIATE TRANSACTION;',
  //        ibmi: 'START TRANSACTION;',
  //      });
  //    });

  it('produces a query used to start a transaction with a parent', () => {
    // @ts-expect-error - this is not a valid Transaction, but it's enough for this test
    expectsql(() => queryGenerator.setIsolationLevelQuery(ISOLATION_LEVELS.SERIALIZABLE, { parent: 'MockTransaction' }), {
      default: ,
    });
  });
});

