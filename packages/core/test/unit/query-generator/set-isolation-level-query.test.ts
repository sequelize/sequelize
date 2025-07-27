import { IsolationLevel } from '@sequelize/core';
import { expectsql, sequelize } from '../../support';

const dialect = sequelize.dialect;
const notSupportedError = new Error(`Isolation levels are not supported by ${dialect.name}.`);
const queryNotSupportedError = new Error(
  `setIsolationLevelQuery is not supported by the ${dialect.name} dialect.`,
);

describe('QueryGenerator#setIsolationLevelQuery', () => {
  const queryGenerator = sequelize.queryGenerator;

  it('should generate a query for setting the isolation level to READ COMMITTED', () => {
    expectsql(() => queryGenerator.setIsolationLevelQuery(IsolationLevel.READ_COMMITTED), {
      default: 'SET TRANSACTION ISOLATION LEVEL READ COMMITTED',
      sqlite3: new Error(
        `The ${IsolationLevel.READ_COMMITTED} isolation level is not supported by ${dialect.name}.`,
      ),
      snowflake: notSupportedError,
      'db2 ibmi mssql': queryNotSupportedError,
    });
  });

  it('should generate a query for setting the isolation level to READ UNCOMMITTED', () => {
    expectsql(() => queryGenerator.setIsolationLevelQuery(IsolationLevel.READ_UNCOMMITTED), {
      default: 'SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED',
      sqlite3: 'PRAGMA read_uncommitted = 1',
      snowflake: notSupportedError,
      'db2 ibmi mssql': queryNotSupportedError,
    });
  });

  it('should generate a query for setting the isolation level to REPEATABLE READ', () => {
    expectsql(() => queryGenerator.setIsolationLevelQuery(IsolationLevel.REPEATABLE_READ), {
      default: 'SET TRANSACTION ISOLATION LEVEL REPEATABLE READ',
      sqlite3: new Error(
        `The ${IsolationLevel.REPEATABLE_READ} isolation level is not supported by ${dialect.name}.`,
      ),
      snowflake: notSupportedError,
      'db2 ibmi mssql': queryNotSupportedError,
    });
  });

  it('should generate a query for setting the isolation level to SERIALIZABLE', () => {
    expectsql(() => queryGenerator.setIsolationLevelQuery(IsolationLevel.SERIALIZABLE), {
      default: 'SET TRANSACTION ISOLATION LEVEL SERIALIZABLE',
      sqlite3: 'PRAGMA read_uncommitted = 0',
      snowflake: notSupportedError,
      'db2 ibmi mssql': queryNotSupportedError,
    });
  });
});
