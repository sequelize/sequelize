import { expectsql, getTestDialect, sequelize } from '../../support';

const dialectName = getTestDialect();

const notSupportedError = new Error(`Listing databases is not supported in ${dialectName}.`);

describe('QueryGenerator#listDatabasesQuery', () => {
  const queryGenerator = sequelize.getQueryInterface().queryGenerator;

  it('produces a query used to list schemas in supported dialects', () => {
    expectsql(() => queryGenerator.listDatabasesQuery(), {
      default: notSupportedError,
      postgres: 'SELECT datname AS name FROM pg_database;',
      mssql: 'SELECT name FROM sys.databases;',
    });
  });
});
