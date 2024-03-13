import {
  allowDeprecationsInSuite,
  createSequelizeInstance,
  expectsql,
  getTestDialect,
  sequelize,
} from '../../support';

const dialectName = getTestDialect();

const notSupportedError = new Error(`Databases are not supported in ${dialectName}.`);

describe('QueryGenerator#dropDatabaseQuery', () => {
  allowDeprecationsInSuite(['SEQUELIZE0023']);

  const queryGenerator = sequelize.queryGenerator;

  it('produces a DROP DATABASE query in supported dialects', () => {
    expectsql(() => queryGenerator.dropDatabaseQuery('myDatabase'), {
      default: notSupportedError,
      'mssql postgres snowflake': 'DROP DATABASE IF EXISTS [myDatabase]',
    });
  });

  it('omits quotes if quoteIdentifiers is false', async () => {
    const noQuoteQueryGenerator = createSequelizeInstance({
      quoteIdentifiers: false,
    }).queryGenerator;

    expectsql(() => noQuoteQueryGenerator.dropDatabaseQuery('myDatabase'), {
      default: notSupportedError,
      mssql: 'DROP DATABASE IF EXISTS [myDatabase]',
      'postgres snowflake': 'DROP DATABASE IF EXISTS myDatabase',
    });
  });
});
