import { createSequelizeInstance, expectsql, getTestDialect, sequelize } from '../../support';

const dialectName = getTestDialect();

const notSupportedUseSchemaError = new Error(`Dropping databases is not supported in ${dialectName}. In ${dialectName}, Databases and Schemas are equivalent. Use dropSchemaQuery instead.`);
const notSupportedError = new Error(`Dropping databases is not supported in ${dialectName}.`);

describe('QueryGenerator#dropDatabaseQuery', () => {
  const queryGenerator = sequelize.getQueryInterface().queryGenerator;
  const noQuoteQueryGenerator = createSequelizeInstance({ quoteIdentifiers: false }).getQueryInterface().queryGenerator;

  it('produces a DROP DATABASE query in supported dialects', () => {
    expectsql(() => queryGenerator.dropDatabaseQuery('myDatabase'), {
      default: 'DROP DATABASE IF EXISTS [myDatabase];',
      'mysql mariadb': notSupportedUseSchemaError,
      'sqlite db2 ibmi': notSupportedError,
      mssql: `IF EXISTS (SELECT * FROM sys.databases WHERE name = 'myDatabase' ) BEGIN DROP DATABASE [myDatabase] ; END;`,
    });
  });

  it('omits quotes if quoteIdentifiers is false', async () => {
    expectsql(() => noQuoteQueryGenerator.dropDatabaseQuery('myDatabase'), {
      default: 'DROP DATABASE IF EXISTS myDatabase;',
      'mysql mariadb': notSupportedUseSchemaError,
      'sqlite db2 ibmi': notSupportedError,
      // TODO: mssql does not respect quoteIdentifiers in this method
      mssql: `IF EXISTS (SELECT * FROM sys.databases WHERE name = 'myDatabase' ) BEGIN DROP DATABASE [myDatabase] ; END;`,
    });
  });
});
