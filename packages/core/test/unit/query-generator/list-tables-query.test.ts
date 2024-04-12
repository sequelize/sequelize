import { buildInvalidOptionReceivedError } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/check.js';
import { expectsql, sequelize } from '../../support';

describe('QueryGenerator#listTablesQuery', () => {
  const queryGenerator = sequelize.queryGenerator;

  it('produces a query that lists all tables', () => {
    expectsql(() => queryGenerator.listTablesQuery(), {
      db2: `SELECT TABNAME AS "tableName", TRIM(TABSCHEMA) AS "schema" FROM SYSCAT.TABLES WHERE TYPE = 'T' AND TABSCHEMA NOT LIKE 'SYS%' AND TABSCHEMA NOT IN ('ERRORSCHEMA', 'NULLID', 'SQLJ') ORDER BY TABSCHEMA, TABNAME`,
      ibmi: `SELECT TABLE_NAME AS "tableName", TABLE_SCHEMA AS "schema" FROM QSYS2.SYSTABLES WHERE TABLE_TYPE = 'T' AND TABLE_SCHEMA NOT LIKE 'Q%' AND TABLE_SCHEMA NOT LIKE 'SYS%' ORDER BY TABLE_SCHEMA, TABLE_NAME`,
      mssql: `SELECT t.name AS [tableName], s.name AS [schema] FROM sys.tables t INNER JOIN sys.schemas s ON t.schema_id = s.schema_id WHERE t.type = 'U' AND s.name NOT IN (N'db_accessadmin', N'db_backupoperator', N'db_datareader', N'db_datawriter', N'db_ddladmin', N'db_denydatareader', N'db_denydatawriter', N'db_owner', N'db_securityadmin', N'INFORMATION_SCHEMA', N'sys') ORDER BY s.name, t.name`,
      mysql: `SELECT TABLE_NAME AS \`tableName\`, TABLE_SCHEMA AS \`schema\` FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_SCHEMA NOT IN ('MYSQL', 'INFORMATION_SCHEMA', 'PERFORMANCE_SCHEMA', 'SYS', 'mysql', 'information_schema', 'performance_schema', 'sys') ORDER BY TABLE_SCHEMA, TABLE_NAME`,
      sqlite3: `SELECT name AS \`tableName\` FROM sqlite_master WHERE type='table' AND name != 'sqlite_sequence'`,
      mariadb: `SELECT TABLE_NAME AS \`tableName\`, TABLE_SCHEMA AS \`schema\` FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_SCHEMA NOT IN ('MYSQL', 'INFORMATION_SCHEMA', 'PERFORMANCE_SCHEMA', 'SYS', 'mysql', 'information_schema', 'performance_schema', 'sys') ORDER BY TABLE_SCHEMA, TABLE_NAME`,
      postgres: `SELECT table_name AS "tableName", table_schema AS "schema" FROM information_schema.tables WHERE table_type = 'BASE TABLE' AND table_name != 'spatial_ref_sys' AND table_schema !~ E'^pg_' AND table_schema NOT IN ('information_schema', 'tiger', 'tiger_data', 'topology') ORDER BY table_schema, table_name`,
      snowflake: `SELECT TABLE_NAME AS "tableName", TABLE_SCHEMA AS "schema" FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_SCHEMA NOT IN ('INFORMATION_SCHEMA', 'PERFORMANCE_SCHEMA', 'SYS', 'information_schema', 'performance_schema', 'sys') ORDER BY TABLE_SCHEMA, TABLE_NAME`,
    });
  });

  it('produces a query that lists all tables with a schema', () => {
    expectsql(() => queryGenerator.listTablesQuery({ schema: 'mySchema' }), {
      db2: `SELECT TABNAME AS "tableName", TRIM(TABSCHEMA) AS "schema" FROM SYSCAT.TABLES WHERE TYPE = 'T' AND TABSCHEMA = 'mySchema' ORDER BY TABSCHEMA, TABNAME`,
      ibmi: `SELECT TABLE_NAME AS "tableName", TABLE_SCHEMA AS "schema" FROM QSYS2.SYSTABLES WHERE TABLE_TYPE = 'T' AND TABLE_SCHEMA = 'mySchema' ORDER BY TABLE_SCHEMA, TABLE_NAME`,
      mssql: `SELECT t.name AS [tableName], s.name AS [schema] FROM sys.tables t INNER JOIN sys.schemas s ON t.schema_id = s.schema_id WHERE t.type = 'U' AND s.name = N'mySchema' ORDER BY s.name, t.name`,
      mysql: `SELECT TABLE_NAME AS \`tableName\`, TABLE_SCHEMA AS \`schema\` FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_SCHEMA = 'mySchema' ORDER BY TABLE_SCHEMA, TABLE_NAME`,
      sqlite3: buildInvalidOptionReceivedError('listTablesQuery', 'sqlite3', ['schema']),
      mariadb: `SELECT TABLE_NAME AS \`tableName\`, TABLE_SCHEMA AS \`schema\` FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_SCHEMA = 'mySchema' ORDER BY TABLE_SCHEMA, TABLE_NAME`,
      postgres: `SELECT table_name AS "tableName", table_schema AS "schema" FROM information_schema.tables WHERE table_type = 'BASE TABLE' AND table_name != 'spatial_ref_sys' AND table_schema = 'mySchema' ORDER BY table_schema, table_name`,
      snowflake: `SELECT TABLE_NAME AS "tableName", TABLE_SCHEMA AS "schema" FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_SCHEMA = 'mySchema' ORDER BY TABLE_SCHEMA, TABLE_NAME`,
    });
  });

  it('produces a query that lists all tables with the default schema', () => {
    expectsql(
      () => queryGenerator.listTablesQuery({ schema: sequelize.dialect.getDefaultSchema() }),
      {
        db2: `SELECT TABNAME AS "tableName", TRIM(TABSCHEMA) AS "schema" FROM SYSCAT.TABLES WHERE TYPE = 'T' AND TABSCHEMA = 'DB2INST1' ORDER BY TABSCHEMA, TABNAME`,
        ibmi: `SELECT TABLE_NAME AS "tableName", TABLE_SCHEMA AS "schema" FROM QSYS2.SYSTABLES WHERE TABLE_TYPE = 'T' AND TABLE_SCHEMA NOT LIKE 'Q%' AND TABLE_SCHEMA NOT LIKE 'SYS%' ORDER BY TABLE_SCHEMA, TABLE_NAME`,
        mssql: `SELECT t.name AS [tableName], s.name AS [schema] FROM sys.tables t INNER JOIN sys.schemas s ON t.schema_id = s.schema_id WHERE t.type = 'U' AND s.name = N'dbo' ORDER BY s.name, t.name`,
        mysql: `SELECT TABLE_NAME AS \`tableName\`, TABLE_SCHEMA AS \`schema\` FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_SCHEMA = 'sequelize_test' ORDER BY TABLE_SCHEMA, TABLE_NAME`,
        sqlite3: buildInvalidOptionReceivedError('listTablesQuery', 'sqlite3', ['schema']),
        mariadb: `SELECT TABLE_NAME AS \`tableName\`, TABLE_SCHEMA AS \`schema\` FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_SCHEMA = 'sequelize_test' ORDER BY TABLE_SCHEMA, TABLE_NAME`,
        postgres: `SELECT table_name AS "tableName", table_schema AS "schema" FROM information_schema.tables WHERE table_type = 'BASE TABLE' AND table_name != 'spatial_ref_sys' AND table_schema = 'public' ORDER BY table_schema, table_name`,
        snowflake: `SELECT TABLE_NAME AS "tableName", TABLE_SCHEMA AS "schema" FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_SCHEMA = 'PUBLIC' ORDER BY TABLE_SCHEMA, TABLE_NAME`,
      },
    );
  });
});
