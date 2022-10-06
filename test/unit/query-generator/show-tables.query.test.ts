import {
  expectsql,
  createSequelizeInstance,
} from '../../support';

const sequelize = createSequelizeInstance();
const queryGenerator = sequelize.getQueryInterface().queryGenerator;

const sequelizeWithSchema = createSequelizeInstance({ schema: 'schema_at_init' });
const queryGeneratorWithSchema = sequelizeWithSchema.getQueryInterface().queryGenerator;

describe('QueryGenerator#showTablesQuery', () => {

  it('should use the schema from initialization options', async () => {
    expectsql(queryGeneratorWithSchema.showTablesQuery(), {
      postgres: `SELECT table_name FROM information_schema.tables WHERE table_schema = 'schema_at_init' AND table_type LIKE '%TABLE' AND table_name != 'spatial_ref_sys';`,
      mssql:
        'SELECT TABLE_NAME, TABLE_SCHEMA FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = \'BASE TABLE\';',
      // TODO fix TABLE_SCHEM typo and missing quotes for CURRENT SCHEMA
      ibmi: `SELECT TABLE_NAME FROM SYSIBM.SQLTABLES WHERE TABLE_TYPE = 'TABLE' AND TABLE_SCHEM = CURRENT SCHEMA`,
      mysql: `SELECT TABLE_NAME, TABLE_SCHEMA FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'   AND TABLE_SCHEMA NOT IN ('MYSQL', 'INFORMATION_SCHEMA', 'PERFORMANCE_SCHEMA', 'SYS', 'mysql', 'information_schema', 'performance_schema', 'sys');`,
      mariadb: `SELECT TABLE_NAME, TABLE_SCHEMA FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'  AND TABLE_SCHEMA NOT IN ('MYSQL', 'INFORMATION_SCHEMA', 'PERFORMANCE_SCHEMA', 'mysql', 'information_schema', 'performance_schema');`,
      sqlite: 'SELECT name FROM `sqlite_master` WHERE type=\'table\' and name!=\'sqlite_sequence\';',
      snowflake: 'SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = \'BASE TABLE\' AND TABLE_SCHEMA NOT IN ( \'INFORMATION_SCHEMA\', \'PERFORMANCE_SCHEMA\', \'SYS\');',
      db2: 'SELECT TABNAME AS "tableName", TRIM(TABSCHEMA) AS "tableSchema" FROM SYSCAT.TABLES WHERE TABSCHEMA = USER AND TYPE = \'T\' ORDER BY TABSCHEMA, TABNAME',
    });
  });

  it('should use method arguments correctly', async () => {
    expectsql(queryGeneratorWithSchema.showTablesQuery('schema_not_at_init'), {
      postgres: `SELECT table_name FROM information_schema.tables WHERE table_schema = 'schema_at_init' AND table_type LIKE '%TABLE' AND table_name != 'spatial_ref_sys';`,
      mssql:
      'SELECT TABLE_NAME, TABLE_SCHEMA FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = \'BASE TABLE\';',
      ibmi: `SELECT TABLE_NAME FROM SYSIBM.SQLTABLES WHERE TABLE_TYPE = 'TABLE' AND TABLE_SCHEM = 'schema_not_at_init'`,
      mysql: `SELECT TABLE_NAME, TABLE_SCHEMA FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'    AND TABLE_SCHEMA = 'schema_not_at_init';`,
      mariadb: `SELECT TABLE_NAME, TABLE_SCHEMA FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'  AND TABLE_SCHEMA = 'schema_not_at_init';`,
      sqlite: 'SELECT name FROM `sqlite_master` WHERE type=\'table\' and name!=\'sqlite_sequence\';',
      snowflake: 'SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = \'BASE TABLE\' AND TABLE_SCHEMA = \'schema_not_at_init\';',
      db2: 'SELECT TABNAME AS "tableName", TRIM(TABSCHEMA) AS "tableSchema" FROM SYSCAT.TABLES WHERE TABSCHEMA = USER AND TYPE = \'T\' ORDER BY TABSCHEMA, TABNAME',
    });

    expectsql(queryGenerator.showTablesQuery('schema_not_at_init'), {
      postgres: `SELECT table_name FROM information_schema.tables WHERE table_schema = 'schema_not_at_init' AND table_type LIKE '%TABLE' AND table_name != 'spatial_ref_sys';`,
      mssql:
      'SELECT TABLE_NAME, TABLE_SCHEMA FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = \'BASE TABLE\';',
      ibmi: `SELECT TABLE_NAME FROM SYSIBM.SQLTABLES WHERE TABLE_TYPE = 'TABLE' AND TABLE_SCHEM = 'schema_not_at_init'`,
      mysql: `SELECT TABLE_NAME, TABLE_SCHEMA FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'    AND TABLE_SCHEMA = 'schema_not_at_init';`,
      mariadb: `SELECT TABLE_NAME, TABLE_SCHEMA FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'  AND TABLE_SCHEMA = 'schema_not_at_init';`,
      sqlite: 'SELECT name FROM `sqlite_master` WHERE type=\'table\' and name!=\'sqlite_sequence\';',
      snowflake: 'SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = \'BASE TABLE\' AND TABLE_SCHEMA = \'schema_not_at_init\';',
      db2: 'SELECT TABNAME AS "tableName", TRIM(TABSCHEMA) AS "tableSchema" FROM SYSCAT.TABLES WHERE TABSCHEMA = USER AND TYPE = \'T\' ORDER BY TABSCHEMA, TABNAME',
    });
  });

});
