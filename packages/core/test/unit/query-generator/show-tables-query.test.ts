import { buildInvalidOptionReceivedError } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/check.js';
import { expectsql, sequelize } from '../../support';

describe('QueryGenerator#showTablesQuery', () => {
  const queryGenerator = sequelize.queryGenerator;

  it('produces a query that shows all tables', () => {
    expectsql(() => queryGenerator.showTablesQuery(), {
      db2: `SELECT TABNAME AS "tableName", TRIM(TABSCHEMA) AS "schema" FROM SYSCAT.TABLES WHERE TYPE = 'T' AND TABSCHEMA NOT IN ('SYSIBM') ORDER BY TABSCHEMA, TABNAME`,
      ibmi: `SELECT TABLE_NAME AS "tableName", TABLE_SCHEM AS "schema" FROM SYSIBM.SQLTABLES WHERE TABLE_TYPE = 'TABLE' AND TABLE_SCHEM NOT IN ('SYSIBM') ORDER BY TABLE_SCHEM, TABLE_NAME`,
      mssql: `SELECT TABLE_NAME AS [tableName], TABLE_SCHEMA AS [schema] FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_SCHEMA, TABLE_NAME`,
      mysql: `SELECT TABLE_NAME AS \`tableName\`, TABLE_SCHEMA AS \`schema\` FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_SCHEMA NOT IN ('MYSQL', 'INFORMATION_SCHEMA', 'PERFORMANCE_SCHEMA', 'SYS', 'mysql', 'information_schema', 'performance_schema', 'sys') ORDER BY TABLE_SCHEMA, TABLE_NAME`,
      sqlite: `SELECT name AS \`tableName\` FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`,
      mariadb: `SELECT TABLE_NAME AS \`tableName\`, TABLE_SCHEMA AS \`schema\` FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_SCHEMA NOT IN ('MYSQL', 'INFORMATION_SCHEMA', 'PERFORMANCE_SCHEMA', 'mysql', 'information_schema', 'performance_schema') ORDER BY TABLE_SCHEMA, TABLE_NAME`,
      postgres: `SELECT TABLE_NAME AS "tableName", TABLE_SCHEMA AS "schema" FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_NAME != 'spatial_ref_sys' AND TABLE_SCHEMA NOT IN ('pg_catalog', 'tiger', 'topology') ORDER BY TABLE_SCHEMA, TABLE_NAME`,
      snowflake: `SELECT TABLE_NAME AS "tableName", TABLE_SCHEMA AS "schema" FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_SCHEMA NOT IN ('INFORMATION_SCHEMA', 'PERFORMANCE_SCHEMA', 'SYS', 'information_schema', 'performance_schema', 'sys') ORDER BY TABLE_SCHEMA, TABLE_NAME`,
    });
  });

  it('produces a query that shows all tables with a schema', () => {
    expectsql(() => queryGenerator.showTablesQuery({ schema: 'mySchema' }), {
      db2: `SELECT TABNAME AS "tableName", TRIM(TABSCHEMA) AS "schema" FROM SYSCAT.TABLES WHERE TYPE = 'T' AND TABSCHEMA = 'mySchema' ORDER BY TABSCHEMA, TABNAME`,
      ibmi: `SELECT TABLE_NAME AS "tableName", TABLE_SCHEM AS "schema" FROM SYSIBM.SQLTABLES WHERE TABLE_TYPE = 'TABLE' AND TABLE_SCHEM = 'mySchema' ORDER BY TABLE_SCHEM, TABLE_NAME`,
      mssql: `SELECT TABLE_NAME AS [tableName], TABLE_SCHEMA AS [schema] FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_SCHEMA = N'mySchema' ORDER BY TABLE_SCHEMA, TABLE_NAME`,
      mysql: `SELECT TABLE_NAME AS \`tableName\`, TABLE_SCHEMA AS \`schema\` FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_SCHEMA = 'mySchema' ORDER BY TABLE_SCHEMA, TABLE_NAME`,
      sqlite: buildInvalidOptionReceivedError('showTablesQuery', 'sqlite', ['schema']),
      mariadb: `SELECT TABLE_NAME AS \`tableName\`, TABLE_SCHEMA AS \`schema\` FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_SCHEMA = 'mySchema' ORDER BY TABLE_SCHEMA, TABLE_NAME`,
      postgres: `SELECT TABLE_NAME AS "tableName", TABLE_SCHEMA AS "schema" FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_NAME != 'spatial_ref_sys' AND TABLE_SCHEMA = 'mySchema' ORDER BY TABLE_SCHEMA, TABLE_NAME`,
      snowflake: `SELECT TABLE_NAME AS "tableName", TABLE_SCHEMA AS "schema" FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_SCHEMA = 'mySchema' ORDER BY TABLE_SCHEMA, TABLE_NAME`,
    });
  });
});
