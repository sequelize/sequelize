import { expectsql, sequelize } from '../../support';

const dialect = sequelize.dialect;
const notSupportedError = new Error(`Savepoints are not supported by ${dialect.name}.`);

describe('QueryGenerator#rollbackSavepointQuery', () => {
  const queryGenerator = sequelize.queryGenerator;

  it('should generate a query for committing a transaction', () => {
    expectsql(() => queryGenerator.rollbackSavepointQuery('mySavepoint'), {
      default: 'ROLLBACK TO SAVEPOINT [mySavepoint]',
      mssql: 'ROLLBACK TRANSACTION [mySavepoint]',
      snowflake: notSupportedError,
    });
  });
});
