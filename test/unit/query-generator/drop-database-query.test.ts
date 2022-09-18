import { createSequelizeInstance, expectsql, getTestDialect, sequelize } from '../../support';

const dialectName = getTestDialect();

const notSupportedError = new Error(`Databases are not supported in ${dialectName}.`);

describe('QueryGenerator#dropDatabaseQuery', () => {
  const queryGenerator = sequelize.getQueryInterface().queryGenerator;
  const noQuoteQueryGenerator = createSequelizeInstance({ quoteIdentifiers: false }).getQueryInterface().queryGenerator;

  it('produces a DROP DATABASE query in supported dialects', () => {
    expectsql(() => queryGenerator.dropDatabaseQuery('myDatabase'), {
      default: 'DROP DATABASE IF EXISTS [myDatabase];',
      'sqlite db2 ibmi mysql mariadb': notSupportedError,
      mssql: `IF EXISTS (SELECT * FROM sys.databases WHERE name = 'myDatabase' ) BEGIN DROP DATABASE [myDatabase] ; END;`,
    });
  });

  it('omits quotes if quoteIdentifiers is false', async () => {
    expectsql(() => noQuoteQueryGenerator.dropDatabaseQuery('myDatabase'), {
      default: 'DROP DATABASE IF EXISTS myDatabase;',
      'sqlite db2 ibmi mysql mariadb': notSupportedError,
      // TODO: mssql does not respect quoteIdentifiers in this method
      mssql: `IF EXISTS (SELECT * FROM sys.databases WHERE name = 'myDatabase' ) BEGIN DROP DATABASE [myDatabase] ; END;`,
    });
  });
});
