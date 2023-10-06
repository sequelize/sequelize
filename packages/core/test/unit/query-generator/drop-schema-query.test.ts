import { expectsql, getTestDialect, sequelize } from '../../support';

const dialectName = getTestDialect();

const notSupportedError = new Error(`Schemas are not supported in ${dialectName}.`);

describe('QueryGenerator#dropSchemaQuery', () => {
  const queryGenerator = sequelize.queryGenerator;

  it('produces a DROP SCHEMA query in supported dialects', () => {
    const testFn = () => {
      const out = queryGenerator.dropSchemaQuery('myDatabase');
      if (typeof out === 'string') {
        return out;
      }

      return out.query;
    };

    expectsql(testFn, {
      default: 'DROP SCHEMA IF EXISTS [myDatabase];',
      'postgres snowflake': 'DROP SCHEMA IF EXISTS "myDatabase" CASCADE;',
      db2: 'CALL SYSPROC.ADMIN_DROP_SCHEMA(\'myDatabase\', NULL, $sequelize_errorSchema, $sequelize_errorTable)',
      ibmi: 'BEGIN IF EXISTS (SELECT * FROM SYSIBM.SQLSCHEMAS WHERE TABLE_SCHEM = \'myDatabase\') THEN SET TRANSACTION ISOLATION LEVEL NO COMMIT; DROP SCHEMA "myDatabase"; COMMIT; END IF; END',
      mssql: `IF EXISTS (SELECT schema_name FROM information_schema.schemata WHERE schema_name = N'myDatabase') BEGIN DECLARE @id INT, @ms_sql NVARCHAR(2000); DECLARE @cascade TABLE (id INT NOT NULL IDENTITY PRIMARY KEY, ms_sql NVARCHAR(2000) NOT NULL); INSERT INTO @cascade (ms_sql) SELECT CASE WHEN o.type IN ('F','PK') THEN N'ALTER TABLE ['+ s.name + N'].[' + p.name + N'] DROP CONSTRAINT [' + o.name + N']' ELSE N'DROP TABLE ['+ s.name + N'].[' + o.name + N']' END FROM sys.objects o JOIN sys.schemas s on o.schema_id = s.schema_id LEFT OUTER JOIN sys.objects p on o.parent_object_id = p.object_id WHERE o.type IN ('F', 'PK', 'U') AND s.name = N'myDatabase' ORDER BY o.type ASC; SELECT TOP 1 @id = id, @ms_sql = ms_sql FROM @cascade ORDER BY id; WHILE @id IS NOT NULL BEGIN BEGIN TRY EXEC sp_executesql @ms_sql; END TRY BEGIN CATCH BREAK; THROW; END CATCH; DELETE FROM @cascade WHERE id = @id; SELECT @id = NULL, @ms_sql = NULL; SELECT TOP 1 @id = id, @ms_sql = ms_sql FROM @cascade ORDER BY id; END EXEC sp_executesql N'DROP SCHEMA [myDatabase] ;' END;`,
      sqlite: notSupportedError,
    });
  });
});
