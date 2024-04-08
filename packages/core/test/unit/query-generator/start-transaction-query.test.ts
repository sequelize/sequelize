import { TransactionType } from '@sequelize/core';
import { buildInvalidOptionReceivedError } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/check.js';
import { expectsql, sequelize } from '../../support';

const dialect = sequelize.dialect;
const notSupportedError = new Error(
  `startTransactionQuery is not supported by the ${dialect.name} dialect.`,
);

describe('QueryGenerator#startTransactionQuery', () => {
  const queryGenerator = sequelize.queryGenerator;

  it('should generate a query for starting a transaction', () => {
    expectsql(() => queryGenerator.startTransactionQuery(), {
      default: 'START TRANSACTION',
      sqlite3: 'BEGIN DEFERRED TRANSACTION',
      'db2 ibmi mssql': notSupportedError,
    });
  });

  it('should generate a query for starting a transaction with a name', () => {
    expectsql(() => queryGenerator.startTransactionQuery({ transactionName: 'myTransaction' }), {
      default: 'START TRANSACTION',
      snowflake: 'START TRANSACTION NAME "myTransaction"',
      sqlite3: 'BEGIN DEFERRED TRANSACTION',
      'db2 ibmi mssql': notSupportedError,
    });
  });

  it('should generate a query for starting a read-only transaction', () => {
    expectsql(() => queryGenerator.startTransactionQuery({ readOnly: true }), {
      default: buildInvalidOptionReceivedError('startTransactionQuery', dialect.name, ['readOnly']),
      'db2 ibmi mssql': notSupportedError,
      'mariadb mysql postgres': 'START TRANSACTION READ ONLY',
    });
  });

  it('should generate a query for starting a deferred transaction', () => {
    expectsql(
      () => queryGenerator.startTransactionQuery({ transactionType: TransactionType.DEFERRED }),
      {
        default: buildInvalidOptionReceivedError('startTransactionQuery', dialect.name, [
          'transactionType',
        ]),
        sqlite3: 'BEGIN DEFERRED TRANSACTION',
        'db2 ibmi mssql': notSupportedError,
      },
    );
  });

  it('should generate a query for starting an immediate transaction', () => {
    expectsql(
      () => queryGenerator.startTransactionQuery({ transactionType: TransactionType.IMMEDIATE }),
      {
        default: buildInvalidOptionReceivedError('startTransactionQuery', dialect.name, [
          'transactionType',
        ]),
        sqlite3: 'BEGIN IMMEDIATE TRANSACTION',
        'db2 ibmi mssql': notSupportedError,
      },
    );
  });

  it('should generate a query for starting an exclusive transaction', () => {
    expectsql(
      () => queryGenerator.startTransactionQuery({ transactionType: TransactionType.EXCLUSIVE }),
      {
        default: buildInvalidOptionReceivedError('startTransactionQuery', dialect.name, [
          'transactionType',
        ]),
        sqlite3: 'BEGIN EXCLUSIVE TRANSACTION',
        'db2 ibmi mssql': notSupportedError,
      },
    );
  });

  it('should generate a query for starting a transaction with all options', () => {
    expectsql(
      () =>
        queryGenerator.startTransactionQuery({
          readOnly: true,
          transactionName: 'myTransaction',
          transactionType: TransactionType.EXCLUSIVE,
        }),
      {
        default: buildInvalidOptionReceivedError('startTransactionQuery', dialect.name, [
          'transactionType',
        ]),
        'snowflake sqlite3': buildInvalidOptionReceivedError(
          'startTransactionQuery',
          dialect.name,
          ['readOnly'],
        ),
        'db2 ibmi mssql': notSupportedError,
      },
    );
  });
});
