import { buildInvalidOptionReceivedError } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/check.js';
import { expectsql, sequelize } from '../../support';

describe('QueryGenerator#showTablesQuery', () => {
  const queryGenerator = sequelize.queryGenerator;

  it('produces a query that shows all tables', () => {
    expectsql(() => queryGenerator.showTablesQuery(), {
      db2: `SELECT TABNAME AS "tableName", TRIM(TABSCHEMA) AS "schema" FROM SYSCAT.TABLES WHERE TYPE = 'T' AND TABSCHEMA NOT LIKE 'SYS%' AND TABSCHEMA NOT IN ('ERRORSCHEMA', 'NULLID', 'SQLJ') ORDER BY TABSCHEMA, TABNAME`,
      ibmi: `SELECT TABLE_NAME AS "tableName", TABLE_SCHEMA AS "schema" FROM QSYS2.SYSTABLES WHERE TABLE_TYPE = 'T' AND TABLE_SCHEMA NOT LIKE 'SYS%' TABLE_SCHEMA NOT IN ('QSYS', 'QSYS2') ORDER BY TABLE_SCHEMA, TABLE_NAME`,
      mssql: `SELECT t.name AS [tableName], s.name AS [schema] FROM sys.tables t INNER JOIN sys.schemas s ON t.schema_id = s.schema_id WHERE t.type = 'U' AND s.name NOT LIKE 'db_%' AND s.name NOT IN (N'INFORMATION_SCHEMA', N'sys') ORDER BY s.name, t.name`,
      mysql: `SELECT TABLE_NAME AS \`tableName\`, TABLE_SCHEMA AS \`schema\` FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_SCHEMA NOT IN ('MYSQL', 'INFORMATION_SCHEMA', 'PERFORMANCE_SCHEMA', 'SYS', 'mysql', 'information_schema', 'performance_schema', 'sys') ORDER BY TABLE_SCHEMA, TABLE_NAME`,
      sqlite: `SELECT name AS \`tableName\` FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`,
      mariadb: `SELECT TABLE_NAME AS \`tableName\`, TABLE_SCHEMA AS \`schema\` FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_SCHEMA NOT IN ('MYSQL', 'INFORMATION_SCHEMA', 'PERFORMANCE_SCHEMA', 'SYS', 'mysql', 'information_schema', 'performance_schema', 'sys') ORDER BY TABLE_SCHEMA, TABLE_NAME`,
      postgres: `SELECT table_name AS "tableName", table_schema AS "schema" FROM information_schema.tables WHERE table_type = 'BASE TABLE' AND table_name != 'spatial_ref_sys' AND table_schema !~ E'^pg_' AND table_schema NOT IN ('information_schema', 'tiger', 'topology') ORDER BY table_schema, table_name`,
      snowflake: `SELECT TABLE_NAME AS "tableName", TABLE_SCHEMA AS "schema" FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_SCHEMA NOT IN ('INFORMATION_SCHEMA', 'PERFORMANCE_SCHEMA', 'SYS', 'information_schema', 'performance_schema', 'sys') ORDER BY TABLE_SCHEMA, TABLE_NAME`,
    });
  });

  it('produces a query that shows all tables with a schema', () => {
    expectsql(() => queryGenerator.showTablesQuery({ schema: 'mySchema' }), {
      db2: `SELECT TABNAME AS "tableName", TRIM(TABSCHEMA) AS "schema" FROM SYSCAT.TABLES WHERE TYPE = 'T' AND TABSCHEMA = 'mySchema' ORDER BY TABSCHEMA, TABNAME`,
      ibmi: `SELECT TABLE_NAME AS "tableName", TABLE_SCHEMA AS "schema" FROM QSYS2.SYSTABLES WHERE TABLE_TYPE = 'T' AND TABLE_SCHEMA = 'mySchema' ORDER BY TABLE_SCHEMA, TABLE_NAME`,
      mssql: `SELECT t.name AS [tableName], s.name AS [schema] FROM sys.tables t INNER JOIN sys.schemas s ON t.schema_id = s.schema_id WHERE t.type = 'U' AND s.name = N'mySchema' ORDER BY s.name, t.name`,
      mysql: `SELECT TABLE_NAME AS \`tableName\`, TABLE_SCHEMA AS \`schema\` FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_SCHEMA = 'mySchema' ORDER BY TABLE_SCHEMA, TABLE_NAME`,
      sqlite: buildInvalidOptionReceivedError('showTablesQuery', 'sqlite', ['schema']),
      mariadb: `SELECT TABLE_NAME AS \`tableName\`, TABLE_SCHEMA AS \`schema\` FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_SCHEMA = 'mySchema' ORDER BY TABLE_SCHEMA, TABLE_NAME`,
      postgres: `SELECT table_name AS "tableName", table_schema AS "schema" FROM information_schema.tables WHERE table_type = 'BASE TABLE' AND table_name != 'spatial_ref_sys' AND table_schema = 'mySchema' ORDER BY table_schema, table_name`,
      snowflake: `SELECT TABLE_NAME AS "tableName", TABLE_SCHEMA AS "schema" FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_SCHEMA = 'mySchema' ORDER BY TABLE_SCHEMA, TABLE_NAME`,
    });
  });
});
