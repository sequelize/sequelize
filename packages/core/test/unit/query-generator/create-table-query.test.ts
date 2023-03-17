import { expectsql, getTestDialect, sequelize } from '../../support';

const dialectName = getTestDialect();

const tablesNotSupportedError = new Error(`Tables are not supported in ${dialectName}.`);
const schemaNotSupportedError = new Error(`Schemas are not supported in ${dialectName}.`);

describe('QueryGenerator#createTableQuery', () => {
  const queryGenerator = sequelize.getQueryInterface().queryGenerator;

  it('produces a CREATE TABLE query in supported dialects', () => {
    expectsql(() => queryGenerator.createTableQuery('myTable', { int: 'INTEGER' }, {}), {
      default: 'CREATE TABLE IF NOT EXISTS [myTable] ([int] INTEGER);',
      ibmi: 'BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE \'42710\' BEGIN END; CREATE TABLE "myTable" ("int" INTEGER); END',
      db2: 'CREATE TABLE IF NOT EXISTS "myTable" ("int" INTEGER);',
      'mysql mariadb': 'CREATE TABLE IF NOT EXISTS `myTable` (`int` INTEGER) ENGINE=InnoDB;',
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([int] INTEGER);`,
    });
  });

  it('produces a CREATE TABLE query with table object', () => {
    expectsql(() => queryGenerator.createTableQuery({ tableName: 'myTable' }, { int: 'INTEGER' }, {}), {
      default: 'CREATE TABLE IF NOT EXISTS [myTable] ([int] INTEGER);',
      ibmi: 'BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE \'42710\' BEGIN END; CREATE TABLE "myTable" ("int" INTEGER); END',
      db2: 'CREATE TABLE IF NOT EXISTS "myTable" ("int" INTEGER);',
      'mysql mariadb': 'CREATE TABLE IF NOT EXISTS `myTable` (`int` INTEGER) ENGINE=InnoDB;',
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([int] INTEGER);`,
    });
  });

  it('produces a CREATE TABLE query with comments', () => {
    expectsql(() => queryGenerator.createTableQuery('myTable', { int: 'INTEGER COMMENT Foo Bar', varchar: 'VARCHAR(50) UNIQUE COMMENT Bar Foo' }, {}), {
      default: tablesNotSupportedError,
      ibmi: 'BEGIN\n    DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE \'42710\'\n      BEGIN END;\n      CREATE TABLE "myTable" ("int" INTEGER COMMENT Foo Bar, "varchar" VARCHAR(50) UNIQUE COMMENT Bar Foo);\n      END',
      db2: 'CREATE TABLE IF NOT EXISTS "myTable" ("int" INTEGER, "varchar" VARCHAR(50) UNIQUE); -- \'Foo Bar\', TableName = "myTable", ColumnName = "int"; -- \'Bar Foo\', TableName = "myTable", ColumnName = "varchar";',
      snowflake: 'CREATE TABLE IF NOT EXISTS "myTable" ("int" INTEGER COMMENT Foo Bar, "varchar" VARCHAR(50) UNIQUE COMMENT Bar Foo);',
      sqlite: 'CREATE TABLE IF NOT EXISTS `myTable` (`int` INTEGER COMMENT Foo Bar, `varchar` VARCHAR(50) UNIQUE COMMENT Bar Foo);',
      postgres: 'CREATE TABLE IF NOT EXISTS "myTable" ("int" INTEGER , "varchar" VARCHAR(50) UNIQUE ); COMMENT ON COLUMN "myTable"."int" IS \'Foo Bar\'; COMMENT ON COLUMN "myTable"."varchar" IS \'Bar Foo\';',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`int` INTEGER COMMENT Foo Bar, `varchar` VARCHAR(50) UNIQUE COMMENT Bar Foo) ENGINE=InnoDB;',
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([int] INTEGER, [varchar] VARCHAR(50) UNIQUE); EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Foo Bar', @level0type = N'Schema', @level0name = N'dbo', @level1type = N'Table', @level1name = [myTable], @level2type = N'Column', @level2name = [int]; EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Bar Foo', @level0type = N'Schema', @level0name = N'dbo', @level1type = N'Table', @level1name = [myTable], @level2type = N'Column', @level2name = [varchar];`,
    });
  });

  it('produces a CREATE TABLE query with comments and table object', () => {
    expectsql(() => queryGenerator.createTableQuery({ tableName: 'myTable' }, { int: 'INTEGER COMMENT Foo Bar', varchar: 'VARCHAR(50) UNIQUE COMMENT Bar Foo' }, {}), {
      default: tablesNotSupportedError,
      ibmi: 'BEGIN\n    DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE \'42710\'\n      BEGIN END;\n      CREATE TABLE "myTable" ("int" INTEGER COMMENT Foo Bar, "varchar" VARCHAR(50) UNIQUE COMMENT Bar Foo);\n      END',
      db2: 'CREATE TABLE IF NOT EXISTS "myTable" ("int" INTEGER, "varchar" VARCHAR(50) UNIQUE); -- \'Foo Bar\', TableName = "myTable", ColumnName = "int"; -- \'Bar Foo\', TableName = "myTable", ColumnName = "varchar";',
      snowflake: 'CREATE TABLE IF NOT EXISTS "myTable" ("int" INTEGER COMMENT Foo Bar, "varchar" VARCHAR(50) UNIQUE COMMENT Bar Foo);',
      sqlite: 'CREATE TABLE IF NOT EXISTS `myTable` (`int` INTEGER COMMENT Foo Bar, `varchar` VARCHAR(50) UNIQUE COMMENT Bar Foo);',
      postgres: 'CREATE TABLE IF NOT EXISTS "myTable" ("int" INTEGER , "varchar" VARCHAR(50) UNIQUE ); COMMENT ON COLUMN "myTable"."int" IS \'Foo Bar\'; COMMENT ON COLUMN "myTable"."varchar" IS \'Bar Foo\';',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`int` INTEGER COMMENT Foo Bar, `varchar` VARCHAR(50) UNIQUE COMMENT Bar Foo) ENGINE=InnoDB;',
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([int] INTEGER, [varchar] VARCHAR(50) UNIQUE); EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Foo Bar', @level0type = N'Schema', @level0name = N'dbo', @level1type = N'Table', @level1name = [myTable], @level2type = N'Column', @level2name = [int]; EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Bar Foo', @level0type = N'Schema', @level0name = N'dbo', @level1type = N'Table', @level1name = [myTable], @level2type = N'Column', @level2name = [varchar];`,
    });
  });

  it('produces a CREATE TABLE query with comments,  table object and schema', () => {
    expectsql(() => queryGenerator.createTableQuery({ tableName: 'myTable', schema: 'someSchema' }, { int: 'INTEGER COMMENT Foo Bar', varchar: 'VARCHAR(50) UNIQUE COMMENT Bar Foo' }, {}), {
      default: schemaNotSupportedError,
      ibmi: 'BEGIN\n    DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE \'42710\'\n      BEGIN END;\n      CREATE TABLE "someSchema"."myTable" ("int" INTEGER COMMENT Foo Bar, "varchar" VARCHAR(50) UNIQUE COMMENT Bar Foo);\n      END',
      db2: 'CREATE TABLE IF NOT EXISTS "someSchema"."myTable" ("int" INTEGER, "varchar" VARCHAR(50) UNIQUE); -- \'Foo Bar\', TableName = "someSchema"."myTable", ColumnName = "int"; -- \'Bar Foo\', TableName = "someSchema"."myTable", ColumnName = "varchar";',
      snowflake: 'CREATE TABLE IF NOT EXISTS "someSchema"."myTable" ("int" INTEGER COMMENT Foo Bar, "varchar" VARCHAR(50) UNIQUE COMMENT Bar Foo);',
      sqlite: 'CREATE TABLE IF NOT EXISTS `someSchema.myTable` (`int` INTEGER COMMENT Foo Bar, `varchar` VARCHAR(50) UNIQUE COMMENT Bar Foo);',
      postgres: 'CREATE TABLE IF NOT EXISTS "someSchema"."myTable" ("int" INTEGER , "varchar" VARCHAR(50) UNIQUE ); COMMENT ON COLUMN "someSchema"."myTable"."int" IS \'Foo Bar\'; COMMENT ON COLUMN "someSchema"."myTable"."varchar" IS \'Bar Foo\';',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `someSchema`.`myTable` (`int` INTEGER COMMENT Foo Bar, `varchar` VARCHAR(50) UNIQUE COMMENT Bar Foo) ENGINE=InnoDB;',
      mssql: `IF OBJECT_ID(N'[someSchema].[myTable]', 'U') IS NULL CREATE TABLE [someSchema].[myTable] ([int] INTEGER, [varchar] VARCHAR(50) UNIQUE); EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Foo Bar', @level0type = N'Schema', @level0name = N'someSchema', @level1type = N'Table', @level1name = [myTable], @level2type = N'Column', @level2name = [int]; EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Bar Foo', @level0type = N'Schema', @level0name = N'someSchema', @level1type = N'Table', @level1name = [myTable], @level2type = N'Column', @level2name = [varchar];`,
    });
  });

});
