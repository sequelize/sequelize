import { buildInvalidOptionReceivedError } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/check.js';
import { expectsql, getTestDialect, sequelize } from '../../support';

const dialectName = getTestDialect();

const notSupportedError = new Error(`Schemas are not supported in ${dialectName}.`);

describe('QueryGenerator#listSchemasQuery', () => {
  const queryGenerator = sequelize.getQueryInterface().queryGenerator;

  it('produces a query used to list schemas in supported dialects', () => {
    expectsql(() => queryGenerator.listSchemasQuery(), {
      default: 'DROP SCHEMA IF EXISTS [myDatabase];',
      mariadb: `SELECT SCHEMA_NAME as schema_name FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME NOT IN ('MYSQL', 'INFORMATION_SCHEMA', 'PERFORMANCE_SCHEMA', 'mysql', 'information_schema', 'performance_schema');`,
      mysql: `SELECT SCHEMA_NAME as schema_name FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME NOT IN ('MYSQL', 'INFORMATION_SCHEMA', 'PERFORMANCE_SCHEMA', 'SYS', 'mysql', 'information_schema', 'performance_schema', 'sys');`,
      mssql: `SELECT "name" as "schema_name" FROM sys.schemas as s WHERE "s"."name" NOT IN (N'INFORMATION_SCHEMA', N'dbo', N'guest', N'sys', N'archive') AND "s"."name" NOT LIKE 'db_%'`,
      'postgres cockroachdb': `SELECT schema_name FROM information_schema.schemata WHERE schema_name !~ E'^pg_' AND schema_name NOT IN ('information_schema', 'public');`,
      ibmi: 'SELECT DISTINCT SCHEMA_NAME AS "schema_name" FROM QSYS2.SYSSCHEMAAUTH WHERE GRANTEE = CURRENT USER',
      db2: `SELECT SCHEMANAME AS "schema_name" FROM SYSCAT.SCHEMATA WHERE (SCHEMANAME NOT LIKE 'SYS%') AND SCHEMANAME NOT IN ('NULLID', 'SQLJ', 'ERRORSCHEMA');`,
      snowflake: `SHOW SCHEMAS;`,
      sqlite: notSupportedError,
    });
  });

  it('supports a skip option', () => {
    expectsql(() => queryGenerator.listSchemasQuery({ skip: ['test', 'Te\'st2'] }), {
      default: buildInvalidOptionReceivedError('listSchemasQuery', dialectName, ['skip']),
      mariadb: `SELECT SCHEMA_NAME as schema_name FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME NOT IN ('MYSQL', 'INFORMATION_SCHEMA', 'PERFORMANCE_SCHEMA', 'mysql', 'information_schema', 'performance_schema', 'test', 'Te\\'st2');`,
      mysql: `SELECT SCHEMA_NAME as schema_name FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME NOT IN ('MYSQL', 'INFORMATION_SCHEMA', 'PERFORMANCE_SCHEMA', 'SYS', 'mysql', 'information_schema', 'performance_schema', 'sys', 'test', 'Te\\'st2');`,
      mssql: `SELECT "name" as "schema_name" FROM sys.schemas as s WHERE "s"."name" NOT IN (N'INFORMATION_SCHEMA', N'dbo', N'guest', N'sys', N'archive', N'test', N'Te''st2') AND "s"."name" NOT LIKE 'db_%'`,
      'postgres cockroachdb': `SELECT schema_name FROM information_schema.schemata WHERE schema_name !~ E'^pg_' AND schema_name NOT IN ('information_schema', 'public', 'test', 'Te''st2');`,
      ibmi: `SELECT DISTINCT SCHEMA_NAME AS "schema_name" FROM QSYS2.SYSSCHEMAAUTH WHERE GRANTEE = CURRENT USER AND SCHEMA_NAME != 'test' AND SCHEMA_NAME != 'Te''st2'`,
      db2: `SELECT SCHEMANAME AS "schema_name" FROM SYSCAT.SCHEMATA WHERE (SCHEMANAME NOT LIKE 'SYS%') AND SCHEMANAME NOT IN ('NULLID', 'SQLJ', 'ERRORSCHEMA', 'test', 'Te''st2');`,
      sqlite: notSupportedError,
    });
  });
});
