import { expectsql, getTestDialect, sequelize } from '../../support';

const dialectName = getTestDialect();

const notSupportedError = new Error(`Schemas are not supported in ${dialectName}.`);

describe('QueryGenerator#listSchemasQuery', () => {
  const queryGenerator = sequelize.queryGenerator;

  it('produces a query used to list schemas in supported dialects', () => {
    expectsql(() => queryGenerator.listSchemasQuery(), {
      db2: `SELECT SCHEMANAME AS "schema" FROM SYSCAT.SCHEMATA WHERE SCHEMANAME NOT LIKE 'SYS%' AND SCHEMANAME NOT IN ('ERRORSCHEMA', 'NULLID', 'SQLJ')`,
      ibmi: `SELECT DISTINCT SCHEMA_NAME AS "schema" FROM QSYS2.SYSSCHEMAAUTH WHERE GRANTEE = CURRENT USER AND SCHEMA_NAME NOT LIKE 'Q%' AND SCHEMA_NAME NOT LIKE 'SYS%'`,
      mssql: `SELECT [name] AS [schema] FROM sys.schemas WHERE [name] NOT IN (N'dbo', N'guest', N'db_accessadmin', N'db_backupoperator', N'db_datareader', N'db_datawriter', N'db_ddladmin', N'db_denydatareader', N'db_denydatawriter', N'db_owner', N'db_securityadmin', N'INFORMATION_SCHEMA', N'sys')`,
      mysql: `SELECT SCHEMA_NAME AS \`schema\` FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME NOT IN ('MYSQL', 'INFORMATION_SCHEMA', 'PERFORMANCE_SCHEMA', 'SYS', 'mysql', 'information_schema', 'performance_schema', 'sys')`,
      mariadb: `SELECT SCHEMA_NAME AS \`schema\` FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME NOT IN ('MYSQL', 'INFORMATION_SCHEMA', 'PERFORMANCE_SCHEMA', 'SYS', 'mysql', 'information_schema', 'performance_schema', 'sys')`,
      sqlite3: notSupportedError,
      postgres: `SELECT schema_name AS "schema" FROM information_schema.schemata WHERE schema_name !~ E'^pg_' AND schema_name NOT IN ('public', 'information_schema', 'tiger', 'tiger_data', 'topology')`,
      snowflake: `SELECT SCHEMA_NAME AS "schema" FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME NOT IN ('INFORMATION_SCHEMA', 'PERFORMANCE_SCHEMA', 'SYS', 'information_schema', 'performance_schema', 'sys')`,
    });
  });

  it('supports a skip option', () => {
    expectsql(() => queryGenerator.listSchemasQuery({ skip: ['test', "Te'st2"] }), {
      db2: `SELECT SCHEMANAME AS "schema" FROM SYSCAT.SCHEMATA WHERE SCHEMANAME NOT LIKE 'SYS%' AND SCHEMANAME NOT IN ('ERRORSCHEMA', 'NULLID', 'SQLJ', 'test', 'Te''st2')`,
      ibmi: `SELECT DISTINCT SCHEMA_NAME AS "schema" FROM QSYS2.SYSSCHEMAAUTH WHERE GRANTEE = CURRENT USER AND SCHEMA_NAME NOT LIKE 'Q%' AND SCHEMA_NAME NOT LIKE 'SYS%' AND SCHEMA_NAME NOT IN ('test', 'Te''st2')`,
      mssql: `SELECT [name] AS [schema] FROM sys.schemas WHERE [name] NOT IN (N'dbo', N'guest', N'db_accessadmin', N'db_backupoperator', N'db_datareader', N'db_datawriter', N'db_ddladmin', N'db_denydatareader', N'db_denydatawriter', N'db_owner', N'db_securityadmin', N'INFORMATION_SCHEMA', N'sys', N'test', N'Te''st2')`,
      mysql: `SELECT SCHEMA_NAME AS \`schema\` FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME NOT IN ('MYSQL', 'INFORMATION_SCHEMA', 'PERFORMANCE_SCHEMA', 'SYS', 'mysql', 'information_schema', 'performance_schema', 'sys', 'test', 'Te\\'st2')`,
      mariadb: `SELECT SCHEMA_NAME AS \`schema\` FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME NOT IN ('MYSQL', 'INFORMATION_SCHEMA', 'PERFORMANCE_SCHEMA', 'SYS', 'mysql', 'information_schema', 'performance_schema', 'sys', 'test', 'Te\\'st2')`,
      sqlite3: notSupportedError,
      postgres: `SELECT schema_name AS "schema" FROM information_schema.schemata WHERE schema_name !~ E'^pg_' AND schema_name NOT IN ('public', 'information_schema', 'tiger', 'tiger_data', 'topology', 'test', 'Te''st2')`,
      snowflake: `SELECT SCHEMA_NAME AS "schema" FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME NOT IN ('INFORMATION_SCHEMA', 'PERFORMANCE_SCHEMA', 'SYS', 'information_schema', 'performance_schema', 'sys', 'test', 'Te''st2')`,
    });
  });
});
