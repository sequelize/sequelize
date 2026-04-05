import { expectsql, getTestDialect, sequelize } from '../../support';

const dialectName = getTestDialect();

const notSupportedError = new Error(`Databases are not supported in ${dialectName}.`);

describe('QueryGenerator#listDatabasesQuery', () => {
  const queryGenerator = sequelize.queryGenerator;

  it('produces a query used to list schemas in supported dialects', () => {
    expectsql(() => queryGenerator.listDatabasesQuery(), {
      default: notSupportedError,
      mssql: `SELECT [name] FROM sys.databases WHERE [name] NOT IN (N'master', N'model', N'msdb', N'tempdb')`,
      postgres: `SELECT datname AS "name" FROM pg_database WHERE datistemplate = false AND datname NOT IN ('postgres')`,
      snowflake: `SELECT DATABASE_NAME as "name", * FROM SNOWFLAKE.INFORMATION_SCHEMA.DATABASES WHERE "name" NOT IN ('SNOWFLAKE', 'SNOWFLAKE$GDS')`,
    });
  });

  it('produces a query used to list schemas in supported dialects with skip option', () => {
    expectsql(() => queryGenerator.listDatabasesQuery({ skip: ['sample_db'] }), {
      default: notSupportedError,
      mssql: `SELECT [name] FROM sys.databases WHERE [name] NOT IN (N'master', N'model', N'msdb', N'tempdb', N'sample_db')`,
      postgres: `SELECT datname AS "name" FROM pg_database WHERE datistemplate = false AND datname NOT IN ('postgres', 'sample_db')`,
      snowflake: `SELECT DATABASE_NAME as "name", * FROM SNOWFLAKE.INFORMATION_SCHEMA.DATABASES WHERE "name" NOT IN ('SNOWFLAKE', 'SNOWFLAKE$GDS') AND UPPER("name") NOT IN (UPPER('sample_db'))`,
    });
  });
});
