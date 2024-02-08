import { createSequelizeInstance, expectsql, getTestDialect, sequelize } from '../../support';

const dialectName = getTestDialect();

const notSupportedError = new Error(`Databases are not supported in ${dialectName}.`);

describe('QueryGenerator#dropDatabaseQuery', () => {
  const queryGenerator = sequelize.queryGenerator;
  const noQuoteQueryGenerator = createSequelizeInstance({ quoteIdentifiers: false }).queryGenerator;

  it('produces a DROP DATABASE query in supported dialects', () => {
    expectsql(() => queryGenerator.dropDatabaseQuery('myDatabase'), {
      default: notSupportedError,
      'mssql postgres snowflake cockroachdb': 'DROP DATABASE IF EXISTS [myDatabase]',
    });
  });

  it('omits quotes if quoteIdentifiers is false', async () => {
    expectsql(() => noQuoteQueryGenerator.dropDatabaseQuery('myDatabase'), {
      default: notSupportedError,
      mssql: 'DROP DATABASE IF EXISTS [myDatabase]',
      'postgres snowflake cockroachdb': 'DROP DATABASE IF EXISTS myDatabase',
    });
  });
});
