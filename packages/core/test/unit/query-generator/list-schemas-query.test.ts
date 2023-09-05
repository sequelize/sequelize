import { buildInvalidOptionReceivedError } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/check.js';
import { expectsql, getTestDialect, sequelize } from '../../support';

const dialectName = getTestDialect();

const notSupportedError = new Error(`Schemas are not supported in ${dialectName}.`);

describe('QueryGenerator#listSchemasQuery', () => {
  const queryGenerator = sequelize.queryGenerator;

  it('produces a query used to list schemas in supported dialects', () => {
    expectsql(() => queryGenerator.listSchemasQuery(), {
      mariadb: `SELECT SCHEMA_NAME AS \`schema\` FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME NOT IN ('MYSQL', 'INFORMATION_SCHEMA', 'PERFORMANCE_SCHEMA', 'SYS', 'mysql', 'information_schema', 'performance_schema', 'sys')`,
      mysql: `SELECT SCHEMA_NAME AS \`schema\` FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME NOT IN ('MYSQL', 'INFORMATION_SCHEMA', 'PERFORMANCE_SCHEMA', 'SYS', 'mysql', 'information_schema', 'performance_schema', 'sys')`,
      mssql: `SELECT [name] AS [schema] FROM sys.schemas WHERE [name] NOT LIKE 'db_%' AND [name] NOT IN (N'dbo', N'guest', N'INFORMATION_SCHEMA', N'sys')`,
      postgres: `SELECT schema_name AS "schema" FROM information_schema.schemata WHERE schema_name !~ E'^pg_' AND schema_name NOT IN ('public', 'information_schema', 'tiger', 'topology')`,
      ibmi: `SELECT DISTINCT SCHEMA_NAME AS "schema" FROM QSYS2.SYSSCHEMAAUTH WHERE GRANTEE = CURRENT USER AND SCHEMA_NAME NOT LIKE 'SYS%' AND SCHEMA_NAME NOT IN ('QSYS', 'QSYS2')`,
      db2: `SELECT SCHEMANAME AS "schema" FROM SYSCAT.SCHEMATA WHERE SCHEMANAME NOT LIKE 'SYS%' AND SCHEMANAME NOT IN ('ERRORSCHEMA', 'NULLID', 'SQLJ')`,
      snowflake: `SELECT SCHEMA_NAME AS "schema" FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME NOT IN ('INFORMATION_SCHEMA', 'PERFORMANCE_SCHEMA', 'SYS', 'information_schema', 'performance_schema', 'sys')`,
      sqlite: notSupportedError,
    });
  });

  it('supports a skip option', () => {
    expectsql(() => queryGenerator.listSchemasQuery({ skip: ['test', 'Te\'st2'] }), {
      default: buildInvalidOptionReceivedError('listSchemasQuery', dialectName, ['skip']),
      mariadb: `SELECT SCHEMA_NAME AS \`schema\` FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME NOT IN ('MYSQL', 'INFORMATION_SCHEMA', 'PERFORMANCE_SCHEMA', 'SYS', 'mysql', 'information_schema', 'performance_schema', 'sys', 'test', 'Te\\'st2')`,
      mysql: `SELECT SCHEMA_NAME AS \`schema\` FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME NOT IN ('MYSQL', 'INFORMATION_SCHEMA', 'PERFORMANCE_SCHEMA', 'SYS', 'mysql', 'information_schema', 'performance_schema', 'sys', 'test', 'Te\\'st2')`,
      mssql: `SELECT [name] AS [schema] FROM sys.schemas WHERE [name] NOT LIKE 'db_%' AND [name] NOT IN (N'dbo', N'guest', N'INFORMATION_SCHEMA', N'sys', N'test', N'Te''st2')`,
      postgres: `SELECT schema_name AS "schema" FROM information_schema.schemata WHERE schema_name !~ E'^pg_' AND schema_name NOT IN ('public', 'information_schema', 'tiger', 'topology', 'test', 'Te''st2')`,
      ibmi: `SELECT DISTINCT SCHEMA_NAME AS "schema" FROM QSYS2.SYSSCHEMAAUTH WHERE GRANTEE = CURRENT USER AND SCHEMA_NAME NOT LIKE 'SYS%' AND SCHEMA_NAME NOT IN ('QSYS', 'QSYS2', 'test', 'Te''st2')`,
      db2: `SELECT SCHEMANAME AS "schema" FROM SYSCAT.SCHEMATA WHERE SCHEMANAME NOT LIKE 'SYS%' AND SCHEMANAME NOT IN ('ERRORSCHEMA', 'NULLID', 'SQLJ', 'test', 'Te''st2')`,
      snowflake: `SELECT SCHEMA_NAME AS "schema" FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME NOT IN ('INFORMATION_SCHEMA', 'PERFORMANCE_SCHEMA', 'SYS', 'information_schema', 'performance_schema', 'sys', 'test', 'Te''st2')`,
      sqlite: notSupportedError,
    });
  });
});
