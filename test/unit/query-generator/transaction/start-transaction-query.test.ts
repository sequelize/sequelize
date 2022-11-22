import { TRANSACTION_TYPES } from '@sequelize/core/_non-semver-use-at-your-own-risk_/transaction.js';
import { expectsql, sequelize } from '../../../support';

describe('QueryGenerator#startTransactionQuery', () => {
  const queryGenerator = sequelize.getQueryInterface().queryGenerator;

  it('produces a query used to start a transaction', () => {
    // @ts-expect-error - this is not a valid Transaction, but it's enough for this test
    expectsql(() => queryGenerator.startTransactionQuery({}), {
      default: 'START TRANSACTION;',
      'mssql sqlite db2': 'BEGIN TRANSACTION;',
      ibmi: 'START TRANSACTION;',
    });
  });

  // TODO: Do we want a test for an unknown transaction type?
  it('produces a query used to start a transaction with a transaction type', () => {
    // @ts-expect-error - this is not a valid Transaction, but it's enough for this test
    expectsql(() => queryGenerator.startTransactionQuery({ options: { type: TRANSACTION_TYPES.IMMEDIATE } }), {
      default: 'START TRANSACTION;',
      'mssql db2': 'BEGIN TRANSACTION;',
      sqlite: 'BEGIN IMMEDIATE TRANSACTION;',
      ibmi: 'START TRANSACTION;',
    });
  });

  it('produces a query used to start a transaction with a parent', () => {
    // @ts-expect-error - this is not a valid Transaction, but it's enough for this test
    expectsql(() => queryGenerator.startTransactionQuery({ parent: 'MockTransaction', name: 'transaction-uid' }), {
      default: 'SAVEPOINT [transaction-uid];',
      mssql: 'SAVE TRANSACTION [transaction-uid];',
      db2: 'SAVE TRANSACTION "transaction-uid";',
      ibmi: 'SAVEPOINT "transaction-uid";',
    });
  });
});
