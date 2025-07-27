import { expectsql, sequelize } from '../../support';

describe('QueryGenerator#versionQuery', () => {
  const queryGenerator = sequelize.queryGenerator;

  it('produces a query that returns the database version', () => {
    expectsql(() => queryGenerator.versionQuery(), {
      'mariadb mysql': 'SELECT VERSION() as `version`',
      postgres: 'SHOW SERVER_VERSION',
      mssql: `DECLARE @ms_ver NVARCHAR(20); SET @ms_ver = REVERSE(CONVERT(NVARCHAR(20), SERVERPROPERTY('ProductVersion'))); SELECT REVERSE(SUBSTRING(@ms_ver, CHARINDEX('.', @ms_ver)+1, 20)) AS 'version'`,
      sqlite3: 'SELECT sqlite_version() as `version`',
      snowflake: 'SELECT CURRENT_VERSION() AS "version"',
      db2: 'select service_level as "version" from TABLE (sysproc.env_get_inst_info()) as A',
      ibmi: `SELECT CONCAT(OS_VERSION, CONCAT('.', OS_RELEASE)) AS "version" FROM SYSIBMADM.ENV_SYS_INFO`,
    });
  });
});
