import { expectsql, sequelize } from '../../support';

const queryGenerator = sequelize.getQueryInterface().queryGenerator;

describe('QueryGenerator#showTablesQuery', () => {
  it('should use method arguments correctly', async () => {
    expectsql(
      queryGenerator.showTablesQuery('schema_not_at_init'),
      {
        postgres: `SELECT table_name FROM information_schema.tables WHERE table_schema = 'schema_not_at_init' AND table_type LIKE '%TABLE' AND table_name != 'spatial_ref_sys';`,
        mssql:
          `SELECT TABLE_NAME, TABLE_SCHEMA FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = schema_not_at_init AND TABLE_TYPE = 'BASE TABLE';`,
        ibmi: `SELECT TABLE_NAME FROM SYSIBM.SQLTABLES WHERE TABLE_TYPE = 'TABLE' AND TABLE_SCHEM = 'schema_not_at_init'`,
        mysql: `SELECT TABLE_NAME, TABLE_SCHEMA FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'    AND TABLE_SCHEMA = 'schema_not_at_init';`,
        mariadb: `SELECT TABLE_NAME, TABLE_SCHEMA FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'  AND TABLE_SCHEMA = 'schema_not_at_init';`,
        sqlite:
        `SELECT name FROM \`sqlite_master\` WHERE type='table' and name!='sqlite_sequence';`,
        snowflake:
          `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_SCHEMA = 'schema_not_at_init';`,
        db2: `SELECT TABNAME AS "tableName", TRIM(TABSCHEMA) AS "tableSchema" FROM SYSCAT.TABLES WHERE TABSCHEMA = schema_not_at_init AND TYPE = 'T' ORDER BY TABSCHEMA, TABNAME`,
      },
    );
  });
});
