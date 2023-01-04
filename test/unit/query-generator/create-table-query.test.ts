import { DataTypes } from '@sequelize/core';
import { expectsql, sequelize } from '../../support';

// TODO: overhaul this test suite when migrating createTableQuery to TypeScript
/**
 * Make methods stricter, throw when using invalid options
 * Accept and test for TableNameOrModel
 * Check if createTableQuery is typed correctly
 * Check if all tests make sense, the current tests are just copied from dialect specific tests and other expectations are added
 * Give tests unique names
 * Make sure that all resulting queries are valid by adding integration tests for QueryInterface.createTable
 * Make use of the default expectation and tick replacements instead of setting an expectation for each dialect individually
 */

describe('QueryGenerator#createSchemaQuery', () => {
  const queryGenerator = sequelize.getQueryInterface().queryGenerator;

  it('createTableQuery', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { int: 'INTEGER' }, {}), {
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`int` INTEGER) ENGINE=InnoDB;',
      postgres: 'CREATE TABLE IF NOT EXISTS "myTable" ("int" INTEGER);',
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([int] INTEGER);`,
      sqlite: 'CREATE TABLE IF NOT EXISTS `myTable` (`int` INTEGER);',
      snowflake: 'CREATE TABLE IF NOT EXISTS "myTable" ("int" INTEGER);',
      db2: 'CREATE TABLE IF NOT EXISTS "myTable" ("int" INTEGER);',
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("int" INTEGER); END`,
    });
  });

  it('createTableQuery', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { title: 'VARCHAR(255)', name: 'VARCHAR(255)' }), {
      default: 'TBD',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`title` VARCHAR(255), `name` VARCHAR(255)) ENGINE=InnoDB;',
      postgres: 'CREATE TABLE IF NOT EXISTS "myTable" ("title" VARCHAR(255), "name" VARCHAR(255));',
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([title] VARCHAR(255), [name] VARCHAR(255));`,
      sqlite: 'CREATE TABLE IF NOT EXISTS `myTable` (`title` VARCHAR(255), `name` VARCHAR(255));',
      snowflake: 'CREATE TABLE IF NOT EXISTS "myTable" ("title" VARCHAR(255), "name" VARCHAR(255));',
      db2: 'CREATE TABLE IF NOT EXISTS "myTable" ("title" VARCHAR(255), "name" VARCHAR(255));',
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("title" VARCHAR(255), "name" VARCHAR(255)); END`,
    });
  });

  it('createTableQuery', () => {
    expectsql(queryGenerator.createTableQuery({ tableName: 'myTable', schema: 'mySchema' }, { title: 'VARCHAR(255)', name: 'VARCHAR(255)' }), {
      default: 'TBD',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `mySchema`.`myTable` (`title` VARCHAR(255), `name` VARCHAR(255)) ENGINE=InnoDB;',
      postgres: 'CREATE TABLE IF NOT EXISTS "mySchema"."myTable" ("title" VARCHAR(255), "name" VARCHAR(255));',
      mssql: `IF OBJECT_ID(N'[mySchema].[myTable]', 'U') IS NULL CREATE TABLE [mySchema].[myTable] ([title] VARCHAR(255), [name] VARCHAR(255));`,
      sqlite: 'CREATE TABLE IF NOT EXISTS `mySchema.myTable` (`title` VARCHAR(255), `name` VARCHAR(255));',
      snowflake: 'CREATE TABLE IF NOT EXISTS "mySchema"."myTable" ("title" VARCHAR(255), "name" VARCHAR(255));',
      db2: 'CREATE TABLE IF NOT EXISTS "mySchema"."myTable" ("title" VARCHAR(255), "name" VARCHAR(255));',
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "mySchema"."myTable" ("title" VARCHAR(255), "name" VARCHAR(255)); END`,
    });
  });

  it('createTableQuery', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { int: 'INTEGER', bigint: 'BIGINT', smallint: 'SMALLINT' }), {
      default: 'TBD',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`int` INTEGER, `bigint` BIGINT, `smallint` SMALLINT) ENGINE=InnoDB;',
      postgres: 'CREATE TABLE IF NOT EXISTS "myTable" ("int" INTEGER, "bigint" BIGINT, "smallint" SMALLINT);',
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([int] INTEGER, [bigint] BIGINT, [smallint] SMALLINT);`,
      sqlite: 'CREATE TABLE IF NOT EXISTS `myTable` (`int` INTEGER, `bigint` BIGINT, `smallint` SMALLINT);',
      snowflake: 'CREATE TABLE IF NOT EXISTS "myTable" ("int" INTEGER, "bigint" BIGINT, "smallint" SMALLINT);',
      db2: 'CREATE TABLE IF NOT EXISTS "myTable" ("int" INTEGER, "bigint" BIGINT, "smallint" SMALLINT);',
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("int" INTEGER, "bigint" BIGINT, "smallint" SMALLINT); END`,
    });
  });

  it('createTableQuery', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { serial: 'INTEGER SERIAL', bigserial: 'BIGINT SERIAL', smallserial: 'SMALLINT SERIAL' }), {
      default: 'TBD',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`serial` INTEGER SERIAL, `bigserial` BIGINT SERIAL, `smallserial` SMALLINT SERIAL) ENGINE=InnoDB;',
      postgres: 'CREATE TABLE IF NOT EXISTS "myTable" ("serial"  SERIAL, "bigserial"  BIGSERIAL, "smallserial"  SMALLSERIAL);',
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([serial] INTEGER SERIAL, [bigserial] BIGINT SERIAL, [smallserial] SMALLINT SERIAL);`,
      sqlite: 'CREATE TABLE IF NOT EXISTS `myTable` (`serial` INTEGER SERIAL, `bigserial` BIGINT SERIAL, `smallserial` SMALLINT SERIAL);',
      snowflake: 'CREATE TABLE IF NOT EXISTS "myTable" ("serial" INTEGER SERIAL, "bigserial" BIGINT SERIAL, "smallserial" SMALLINT SERIAL);',
      db2: 'CREATE TABLE IF NOT EXISTS "myTable" ("serial" INTEGER SERIAL, "bigserial" BIGINT SERIAL, "smallserial" SMALLINT SERIAL);',
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("serial" INTEGER SERIAL, "bigserial" BIGINT SERIAL, "smallserial" SMALLINT SERIAL); END`,
    });
  });

  it('createTableQuery', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { int: 'INTEGER COMMENT Test', foo: 'INTEGER COMMENT Foo Comment' }), {
      default: 'TBD',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`int` INTEGER COMMENT Test, `foo` INTEGER COMMENT Foo Comment) ENGINE=InnoDB;',
      postgres: `CREATE TABLE IF NOT EXISTS "myTable" ("int" INTEGER , "foo" INTEGER ); COMMENT ON COLUMN "myTable"."int" IS 'Test'; COMMENT ON COLUMN "myTable"."foo" IS 'Foo Comment';`,
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([int] INTEGER, [foo] INTEGER); EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Test',
        @level0type = N'Schema', @level0name = 'dbo', @level1type = N'Table', @level1name = [myTable], @level2type = N'Column', @level2name = [int]; EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Foo Comment', @level0type = N'Schema', @level0name = 'dbo', @level1type = N'Table', @level1name = [myTable], @level2type = N'Column', @level2name = [foo];`,
      sqlite: 'CREATE TABLE IF NOT EXISTS `myTable` (`int` INTEGER COMMENT Test, `foo` INTEGER COMMENT Foo Comment);',
      snowflake: 'CREATE TABLE IF NOT EXISTS "myTable" ("int" INTEGER COMMENT Test, "foo" INTEGER COMMENT Foo Comment);',
      db2: `CREATE TABLE IF NOT EXISTS "myTable" ("int" INTEGER, "foo" INTEGER); -- 'Test', TableName = "myTable", ColumnName = "int"; -- 'Foo Comment', TableName = "myTable", ColumnName = "foo";`,
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("int" INTEGER COMMENT Test, "foo" INTEGER COMMENT Foo Comment); END`,
    });
  });

  it('createTableQuery', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { data: 'BLOB' }), {
      default: 'TBD',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`data` BLOB) ENGINE=InnoDB;',
      postgres: 'CREATE TABLE IF NOT EXISTS "myTable" ("data" BLOB);',
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([data] BLOB);`,
      sqlite: 'CREATE TABLE IF NOT EXISTS `myTable` (`data` BLOB);',
      snowflake: 'CREATE TABLE IF NOT EXISTS "myTable" ("data" BLOB);',
      db2: 'CREATE TABLE IF NOT EXISTS "myTable" ("data" BLOB);',
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("data" BLOB); END`,
    });
  });

  it('createTableQuery', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { data: 'LONGBLOB' }), {
      default: 'TBD',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`data` LONGBLOB) ENGINE=InnoDB;',
      postgres: 'CREATE TABLE IF NOT EXISTS "myTable" ("data" LONGBLOB);',
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([data] LONGBLOB);`,
      sqlite: 'CREATE TABLE IF NOT EXISTS `myTable` (`data` LONGBLOB);',
      snowflake: 'CREATE TABLE IF NOT EXISTS "myTable" ("data" LONGBLOB);',
      db2: 'CREATE TABLE IF NOT EXISTS "myTable" ("data" LONGBLOB);',
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("data" LONGBLOB); END`,
    });
  });

  it('createTableQuery', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { data: 'BLOB(16M)' }), {
      default: 'TBD',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`data` BLOB(16M)) ENGINE=InnoDB;',
      postgres: 'CREATE TABLE IF NOT EXISTS "myTable" ("data" BLOB(16M));',
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([data] BLOB(16M));`,
      sqlite: 'CREATE TABLE IF NOT EXISTS `myTable` (`data` BLOB(16M));',
      snowflake: 'CREATE TABLE IF NOT EXISTS "myTable" ("data" BLOB(16M));',
      db2: 'CREATE TABLE IF NOT EXISTS "myTable" ("data" BLOB(16M));',
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("data" BLOB(16M)); END`,
    });
  });

  it('createTableQuery', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { data: sequelize.normalizeDataType(DataTypes.BLOB).toSql({ dialect: sequelize.dialect }) }), {
      default: 'TBD',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`data` BLOB) ENGINE=InnoDB;',
      postgres: 'CREATE TABLE IF NOT EXISTS "myTable" ("data" BYTEA);',
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([data] VARBINARY(MAX));`,
      sqlite: 'CREATE TABLE IF NOT EXISTS `myTable` (`data` BLOB);',
      snowflake: 'CREATE TABLE IF NOT EXISTS "myTable" ("data" BLOB);',
      db2: 'CREATE TABLE IF NOT EXISTS "myTable" ("data" BLOB(1M));',
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("data" BLOB(1M)); END`,
    });
  });

  it('createTableQuery', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { data: sequelize.normalizeDataType(DataTypes.BLOB('long')).toSql({ dialect: sequelize.dialect }) }), {
      default: 'TBD',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`data` LONGBLOB) ENGINE=InnoDB;',
      postgres: 'CREATE TABLE IF NOT EXISTS "myTable" ("data" BYTEA);',
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([data] VARBINARY(MAX));`,
      sqlite: 'CREATE TABLE IF NOT EXISTS `myTable` (`data` BLOB);',
      snowflake: 'CREATE TABLE IF NOT EXISTS "myTable" ("data" LONGBLOB);',
      db2: 'CREATE TABLE IF NOT EXISTS "myTable" ("data" BLOB(2G));',
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("data" BLOB(2G)); END`,
    });
  });

  it('createTableQuery', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { title: 'ENUM("A", "B", "C")', name: 'VARCHAR(255)' }), {
      default: 'TBD',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`title` ENUM("A", "B", "C"), `name` VARCHAR(255)) ENGINE=InnoDB;',
      postgres: 'CREATE TABLE IF NOT EXISTS "myTable" ("title" "public"."enum_myTable_title", "name" VARCHAR(255));',
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([title] ENUM("A", "B", "C"), [name] VARCHAR(255));`,
      sqlite: 'CREATE TABLE IF NOT EXISTS `myTable` (`title` ENUM("A", "B", "C"), `name` VARCHAR(255));',
      snowflake: 'CREATE TABLE IF NOT EXISTS "myTable" ("title" ENUM("A", "B", "C"), "name" VARCHAR(255));',
      db2: 'CREATE TABLE IF NOT EXISTS "myTable" ("title" ENUM("A", "B", "C"), "name" VARCHAR(255));',
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("title" ENUM("A", "B", "C"), "name" VARCHAR(255)); END`,
    });
  });

  it('createTableQuery', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { title: 'VARCHAR(255)', name: 'VARCHAR(255)' }, { engine: 'MyISAM' }), {
      default: 'TBD',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`title` VARCHAR(255), `name` VARCHAR(255)) ENGINE=MyISAM;',
      postgres: 'CREATE TABLE IF NOT EXISTS "myTable" ("title" VARCHAR(255), "name" VARCHAR(255));',
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([title] VARCHAR(255), [name] VARCHAR(255));`,
      sqlite: 'CREATE TABLE IF NOT EXISTS `myTable` (`title` VARCHAR(255), `name` VARCHAR(255));',
      snowflake: 'CREATE TABLE IF NOT EXISTS "myTable" ("title" VARCHAR(255), "name" VARCHAR(255));',
      db2: 'CREATE TABLE IF NOT EXISTS "myTable" ("title" VARCHAR(255), "name" VARCHAR(255));',
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("title" VARCHAR(255), "name" VARCHAR(255)); END`,
    });
  });

  it('createTableQuery', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { title: 'VARCHAR(255)', name: 'VARCHAR(255)' }, { charset: 'utf8', collate: 'utf8_unicode_ci' }), {
      default: 'TBD',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`title` VARCHAR(255), `name` VARCHAR(255)) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE utf8_unicode_ci;',
      postgres: 'CREATE TABLE IF NOT EXISTS "myTable" ("title" VARCHAR(255), "name" VARCHAR(255));',
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([title] VARCHAR(255), [name] VARCHAR(255));`,
      sqlite: 'CREATE TABLE IF NOT EXISTS `myTable` (`title` VARCHAR(255), `name` VARCHAR(255));',
      snowflake: 'CREATE TABLE IF NOT EXISTS "myTable" ("title" VARCHAR(255), "name" VARCHAR(255)) DEFAULT CHARSET=utf8 COLLATE utf8_unicode_ci;',
      db2: 'CREATE TABLE IF NOT EXISTS "myTable" ("title" VARCHAR(255), "name" VARCHAR(255));',
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("title" VARCHAR(255), "name" VARCHAR(255)); END`,
    });
  });

  it('createTableQuery', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { title: 'VARCHAR(255)', name: 'VARCHAR(255)' }, { charset: 'latin1' }), {
      default: 'TBD',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`title` VARCHAR(255), `name` VARCHAR(255)) ENGINE=InnoDB DEFAULT CHARSET=latin1;',
      postgres: 'CREATE TABLE IF NOT EXISTS "myTable" ("title" VARCHAR(255), "name" VARCHAR(255));',
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([title] VARCHAR(255), [name] VARCHAR(255));`,
      sqlite: 'CREATE TABLE IF NOT EXISTS `myTable` (`title` VARCHAR(255), `name` VARCHAR(255));',
      snowflake: 'CREATE TABLE IF NOT EXISTS "myTable" ("title" VARCHAR(255), "name" VARCHAR(255)) DEFAULT CHARSET=latin1;',
      db2: 'CREATE TABLE IF NOT EXISTS "myTable" ("title" VARCHAR(255), "name" VARCHAR(255));',
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("title" VARCHAR(255), "name" VARCHAR(255)); END`,
    });
  });

  it('createTableQuery', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { title: 'ENUM("A", "B", "C")', name: 'VARCHAR(255)' }, { charset: 'latin1' }), {
      default: 'TBD',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`title` ENUM("A", "B", "C"), `name` VARCHAR(255)) ENGINE=InnoDB DEFAULT CHARSET=latin1;',
      postgres: 'CREATE TABLE IF NOT EXISTS "myTable" ("title" "public"."enum_myTable_title", "name" VARCHAR(255));',
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([title] ENUM("A", "B", "C"), [name] VARCHAR(255));`,
      sqlite: 'CREATE TABLE IF NOT EXISTS `myTable` (`title` ENUM("A", "B", "C"), `name` VARCHAR(255));',
      snowflake: 'CREATE TABLE IF NOT EXISTS "myTable" ("title" ENUM("A", "B", "C"), "name" VARCHAR(255)) DEFAULT CHARSET=latin1;',
      db2: 'CREATE TABLE IF NOT EXISTS "myTable" ("title" ENUM("A", "B", "C"), "name" VARCHAR(255));',
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("title" ENUM("A", "B", "C"), "name" VARCHAR(255)); END`,
    });
  });

  it('createTableQuery', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { title: 'VARCHAR(255)', name: 'VARCHAR(255)' }, { rowFormat: 'default' }), {
      default: 'TBD',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`title` VARCHAR(255), `name` VARCHAR(255)) ENGINE=InnoDB ROW_FORMAT=default;',
      postgres: 'CREATE TABLE IF NOT EXISTS "myTable" ("title" VARCHAR(255), "name" VARCHAR(255));',
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([title] VARCHAR(255), [name] VARCHAR(255));`,
      sqlite: 'CREATE TABLE IF NOT EXISTS `myTable` (`title` VARCHAR(255), `name` VARCHAR(255));',
      snowflake: 'CREATE TABLE IF NOT EXISTS "myTable" ("title" VARCHAR(255), "name" VARCHAR(255)) ROW_FORMAT=default;',
      db2: 'CREATE TABLE IF NOT EXISTS "myTable" ("title" VARCHAR(255), "name" VARCHAR(255));',
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("title" VARCHAR(255), "name" VARCHAR(255)); END`,
    });
  });

  it('createTableQuery', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { title: 'VARCHAR(255)', name: 'VARCHAR(255)', id: 'INTEGER PRIMARY KEY' }), {
      default: 'TBD',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`title` VARCHAR(255), `name` VARCHAR(255), `id` INTEGER , PRIMARY KEY (`id`)) ENGINE=InnoDB;',
      postgres: 'CREATE TABLE IF NOT EXISTS "myTable" ("title" VARCHAR(255), "name" VARCHAR(255), "id" INTEGER , PRIMARY KEY ("id"));',
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([title] VARCHAR(255), [name] VARCHAR(255), [id] INTEGER, PRIMARY KEY ([id]));`,
      sqlite: 'CREATE TABLE IF NOT EXISTS `myTable` (`title` VARCHAR(255), `name` VARCHAR(255), `id` INTEGER PRIMARY KEY);',
      snowflake: 'CREATE TABLE IF NOT EXISTS "myTable" ("title" VARCHAR(255), "name" VARCHAR(255), "id" INTEGER , PRIMARY KEY ("id"));',
      db2: 'CREATE TABLE IF NOT EXISTS "myTable" ("title" VARCHAR(255), "name" VARCHAR(255), "id" INTEGER , PRIMARY KEY ("id"));',
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("title" VARCHAR(255), "name" VARCHAR(255), "id" INTEGER, PRIMARY KEY ("id")); END`,
    });
  });

  it('createTableQuery', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { title: 'VARCHAR(255)', name: 'VARCHAR(255)', otherId: 'INTEGER REFERENCES otherTable (id) ON DELETE CASCADE ON UPDATE NO ACTION' }), {
      default: 'TBD',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`title` VARCHAR(255), `name` VARCHAR(255), `otherId` INTEGER, FOREIGN KEY (`otherId`) REFERENCES otherTable (id) ON DELETE CASCADE ON UPDATE NO ACTION) ENGINE=InnoDB;',
      postgres: 'CREATE TABLE IF NOT EXISTS "myTable" ("title" VARCHAR(255), "name" VARCHAR(255), "otherId" INTEGER REFERENCES otherTable (id) ON DELETE CASCADE ON UPDATE NO ACTION);',
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([title] VARCHAR(255), [name] VARCHAR(255), [otherId] INTEGER, FOREIGN KEY ([otherId]) REFERENCES otherTable (id) ON DELETE CASCADE ON UPDATE NO ACTION);`,
      sqlite: 'CREATE TABLE IF NOT EXISTS `myTable` (`title` VARCHAR(255), `name` VARCHAR(255), `otherId` INTEGER REFERENCES otherTable (id) ON DELETE CASCADE ON UPDATE NO ACTION);',
      snowflake: 'CREATE TABLE IF NOT EXISTS "myTable" ("title" VARCHAR(255), "name" VARCHAR(255), "otherId" INTEGER, FOREIGN KEY ("otherId") REFERENCES otherTable (id) ON DELETE CASCADE ON UPDATE NO ACTION);',
      db2: 'CREATE TABLE IF NOT EXISTS "myTable" ("title" VARCHAR(255), "name" VARCHAR(255), "otherId" INTEGER, FOREIGN KEY ("otherId") REFERENCES otherTable (id) ON DELETE CASCADE ON UPDATE NO ACTION);',
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("title" VARCHAR(255), "name" VARCHAR(255), "otherId" INTEGER REFERENCES otherTable (id) ON DELETE CASCADE ON UPDATE NO ACTION); END`,
    });
  });

  it('createTableQuery', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { title: 'VARCHAR(255)', name: 'VARCHAR(255)', otherId: 'INTEGER REFERENCES "otherTable" ("id") ON DELETE CASCADE ON UPDATE NO ACTION' }), {
      default: 'TBD',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`title` VARCHAR(255), `name` VARCHAR(255), `otherId` INTEGER, FOREIGN KEY (`otherId`) REFERENCES "otherTable" ("id") ON DELETE CASCADE ON UPDATE NO ACTION) ENGINE=InnoDB;',
      postgres: 'CREATE TABLE IF NOT EXISTS "myTable" ("title" VARCHAR(255), "name" VARCHAR(255), "otherId" INTEGER REFERENCES "otherTable" ("id") ON DELETE CASCADE ON UPDATE NO ACTION);',
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([title] VARCHAR(255), [name] VARCHAR(255), [otherId] INTEGER, FOREIGN KEY ([otherId]) REFERENCES "otherTable" ("id") ON DELETE CASCADE ON UPDATE NO ACTION);`,
      sqlite: 'CREATE TABLE IF NOT EXISTS `myTable` (`title` VARCHAR(255), `name` VARCHAR(255), `otherId` INTEGER REFERENCES "otherTable" ("id") ON DELETE CASCADE ON UPDATE NO ACTION);',
      snowflake: 'CREATE TABLE IF NOT EXISTS "myTable" ("title" VARCHAR(255), "name" VARCHAR(255), "otherId" INTEGER, FOREIGN KEY ("otherId") REFERENCES "otherTable" ("id") ON DELETE CASCADE ON UPDATE NO ACTION);',
      db2: 'CREATE TABLE IF NOT EXISTS "myTable" ("title" VARCHAR(255), "name" VARCHAR(255), "otherId" INTEGER, FOREIGN KEY ("otherId") REFERENCES "otherTable" ("id") ON DELETE CASCADE ON UPDATE NO ACTION);',
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("title" VARCHAR(255), "name" VARCHAR(255), "otherId" INTEGER REFERENCES "otherTable" ("id") ON DELETE CASCADE ON UPDATE NO ACTION); END`,
    });
  });

  it('createTableQuery', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { title: 'VARCHAR(255)', name: 'VARCHAR(255)', otherId: 'INTEGER REFERENCES `otherTable` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION' }), {
      default: 'TBD',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`title` VARCHAR(255), `name` VARCHAR(255), `otherId` INTEGER, FOREIGN KEY (`otherId`) REFERENCES `otherTable` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION) ENGINE=InnoDB;',
      postgres: 'CREATE TABLE IF NOT EXISTS "myTable" ("title" VARCHAR(255), "name" VARCHAR(255), "otherId" INTEGER REFERENCES `otherTable` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION);',
      mssql: 'IF OBJECT_ID(N\'[myTable]\', \'U\') IS NULL CREATE TABLE [myTable] ([title] VARCHAR(255), [name] VARCHAR(255), [otherId] INTEGER, FOREIGN KEY ([otherId]) REFERENCES `otherTable` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION);',
      sqlite: 'CREATE TABLE IF NOT EXISTS `myTable` (`title` VARCHAR(255), `name` VARCHAR(255), `otherId` INTEGER REFERENCES `otherTable` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION);',
      snowflake: 'CREATE TABLE IF NOT EXISTS "myTable" ("title" VARCHAR(255), "name" VARCHAR(255), "otherId" INTEGER, FOREIGN KEY ("otherId") REFERENCES `otherTable` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION);',
      db2: 'CREATE TABLE IF NOT EXISTS "myTable" ("title" VARCHAR(255), "name" VARCHAR(255), "otherId" INTEGER, FOREIGN KEY ("otherId") REFERENCES `otherTable` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION);',
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("title" VARCHAR(255), "name" VARCHAR(255), "otherId" INTEGER REFERENCES \`otherTable\` (\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION); END`,
    });
  });

  it('createTableQuery', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { title: 'VARCHAR(255)', name: 'VARCHAR(255)' }, { uniqueKeys: [{ fields: ['title', 'name'] }] }), {
      default: 'TBD',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`title` VARCHAR(255), `name` VARCHAR(255), UNIQUE `uniq_myTable_title_name` (`title`, `name`)) ENGINE=InnoDB;',
      postgres: 'CREATE TABLE IF NOT EXISTS "myTable" ("title" VARCHAR(255), "name" VARCHAR(255), CONSTRAINT "my_table_title_name" UNIQUE ("title", "name"));',
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([title] VARCHAR(255), [name] VARCHAR(255), CONSTRAINT [my_table_title_name] UNIQUE ([title], [name]));`,
      sqlite: 'CREATE TABLE IF NOT EXISTS `myTable` (`title` VARCHAR(255), `name` VARCHAR(255));',
      snowflake: 'CREATE TABLE IF NOT EXISTS "myTable" ("title" VARCHAR(255), "name" VARCHAR(255), UNIQUE "uniq_myTable_title_name" ("title", "name"));',
      db2: 'CREATE TABLE IF NOT EXISTS "myTable" ("title" VARCHAR(255) NOT NULL, "name" VARCHAR(255) NOT NULL, CONSTRAINT "uniq_myTable_title_name" UNIQUE ("title", "name"));',
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("title" VARCHAR(255), "name" VARCHAR(255), CONSTRAINT "uniq_myTable_title_name" UNIQUE ("title", "name")); END`,
    });
  });

  it('createTableQuery', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { id: 'INTEGER auto_increment PRIMARY KEY' }, { initialAutoIncrement: 1_000_001 }), {
      default: 'TBD',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`id` INTEGER auto_increment , PRIMARY KEY (`id`)) ENGINE=InnoDB AUTO_INCREMENT=1000001;',
      postgres: 'CREATE TABLE IF NOT EXISTS "myTable" ("id" INTEGER auto_increment, PRIMARY KEY ("id"));',
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([id] INTEGER auto_increment, PRIMARY KEY ([id]));`,
      sqlite: 'CREATE TABLE IF NOT EXISTS `myTable` (`id` INTEGER PRIMARY KEY);',
      snowflake: 'CREATE TABLE IF NOT EXISTS "myTable" ("id" INTEGER auto_increment, PRIMARY KEY ("id"));',
      db2: 'CREATE TABLE IF NOT EXISTS "myTable" ("id" INTEGER auto_increment, PRIMARY KEY ("id"));',
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("id" INTEGER auto_increment, PRIMARY KEY ("id")); END`,
    });
  });

  it('createTableQuery', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { title: 'VARCHAR BINARY(255)', number: 'INTEGER(5) UNSIGNED PRIMARY KEY ' }), {
      default: 'TBD',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`title` VARCHAR BINARY(255), `number` INTEGER(5) UNSIGNED, PRIMARY KEY (`number`)) ENGINE=InnoDB;',
      postgres: 'CREATE TABLE IF NOT EXISTS "myTable" ("title" VARCHAR BINARY(255), "number" INTEGER(5) UNSIGNED, PRIMARY KEY ("number"));',
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([title] VARCHAR BINARY(255), [number] INTEGER(5) UNSIGNED, PRIMARY KEY ([number]));`,
      // length and unsigned are not allowed on primary key for sqlite
      sqlite: 'CREATE TABLE IF NOT EXISTS `myTable` (`title` VARCHAR BINARY(255), `number` INTEGER PRIMARY KEY);',
      snowflake: 'CREATE TABLE IF NOT EXISTS "myTable" ("title" VARCHAR BINARY(255), "number" INTEGER(5) UNSIGNED, PRIMARY KEY ("number"));',
      db2: 'CREATE TABLE IF NOT EXISTS "myTable" ("title" VARCHAR BINARY(255), "number" INTEGER(5) UNSIGNED, PRIMARY KEY ("number"));',
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("title" VARCHAR BINARY(255), "number" INTEGER(5) UNSIGNED, PRIMARY KEY ("number")); END`,
    });
  });

  it('createTableQuery', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { id: 'INTEGER PRIMARY KEY AUTOINCREMENT', name: 'VARCHAR(255)' }), {
      default: 'TBD',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`id` INTEGER AUTOINCREMENT, `name` VARCHAR(255), PRIMARY KEY (`id`)) ENGINE=InnoDB;',
      postgres: 'CREATE TABLE IF NOT EXISTS "myTable" ("id" INTEGER AUTOINCREMENT, "name" VARCHAR(255), PRIMARY KEY ("id"));',
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([id] INTEGER AUTOINCREMENT, [name] VARCHAR(255), PRIMARY KEY ([id]));`,
      sqlite: 'CREATE TABLE IF NOT EXISTS `myTable` (`id` INTEGER PRIMARY KEY AUTOINCREMENT, `name` VARCHAR(255));',
      snowflake: 'CREATE TABLE IF NOT EXISTS "myTable" ("id" INTEGER AUTOINCREMENT, "name" VARCHAR(255), PRIMARY KEY ("id"));',
      db2: 'CREATE TABLE IF NOT EXISTS "myTable" ("id" INTEGER AUTOINCREMENT, "name" VARCHAR(255), PRIMARY KEY ("id"));',
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("id" INTEGER AUTOINCREMENT, "name" VARCHAR(255), PRIMARY KEY ("id")); END`,
    });
  });

  it('createTableQuery', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { id: 'INTEGER(4) PRIMARY KEY AUTOINCREMENT', name: 'VARCHAR(255)' }), {
      default: 'TBD',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`id` INTEGER(4) AUTOINCREMENT, `name` VARCHAR(255), PRIMARY KEY (`id`)) ENGINE=InnoDB;',
      postgres: 'CREATE TABLE IF NOT EXISTS "myTable" ("id" INTEGER(4) AUTOINCREMENT, "name" VARCHAR(255), PRIMARY KEY ("id"));',
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([id] INTEGER(4) AUTOINCREMENT, [name] VARCHAR(255), PRIMARY KEY ([id]));`,
      sqlite: 'CREATE TABLE IF NOT EXISTS `myTable` (`id` INTEGER PRIMARY KEY AUTOINCREMENT, `name` VARCHAR(255));',
      snowflake: 'CREATE TABLE IF NOT EXISTS "myTable" ("id" INTEGER(4) AUTOINCREMENT, "name" VARCHAR(255), PRIMARY KEY ("id"));',
      db2: 'CREATE TABLE IF NOT EXISTS "myTable" ("id" INTEGER(4) AUTOINCREMENT, "name" VARCHAR(255), PRIMARY KEY ("id"));',
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("id" INTEGER(4) AUTOINCREMENT, "name" VARCHAR(255), PRIMARY KEY ("id")); END`,
    });
  });

  it('createTableQuery', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { id: 'SMALLINT(4) PRIMARY KEY AUTOINCREMENT UNSIGNED', name: 'VARCHAR(255)' }), {
      default: 'TBD',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`id` SMALLINT(4) AUTOINCREMENT UNSIGNED, `name` VARCHAR(255), PRIMARY KEY (`id`)) ENGINE=InnoDB;',
      postgres: 'CREATE TABLE IF NOT EXISTS "myTable" ("id" SMALLINT(4) AUTOINCREMENT UNSIGNED, "name" VARCHAR(255), PRIMARY KEY ("id"));',
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([id] SMALLINT(4) AUTOINCREMENT UNSIGNED, [name] VARCHAR(255), PRIMARY KEY ([id]));`,
      sqlite: 'CREATE TABLE IF NOT EXISTS `myTable` (`id` INTEGER PRIMARY KEY AUTOINCREMENT, `name` VARCHAR(255));',
      snowflake: 'CREATE TABLE IF NOT EXISTS "myTable" ("id" SMALLINT(4) AUTOINCREMENT UNSIGNED, "name" VARCHAR(255), PRIMARY KEY ("id"));',
      db2: 'CREATE TABLE IF NOT EXISTS "myTable" ("id" SMALLINT(4) AUTOINCREMENT UNSIGNED, "name" VARCHAR(255), PRIMARY KEY ("id"));',
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("id" SMALLINT(4) AUTOINCREMENT UNSIGNED, "name" VARCHAR(255), PRIMARY KEY ("id")); END`,
    });
  });

  it('createTableQuery', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { id: 'INTEGER PRIMARY KEY AUTOINCREMENT', name: 'VARCHAR(255)', surname: 'VARCHAR(255)' }, { uniqueKeys: { uniqueConstraint: { fields: ['name', 'surname'] } } }), {
      default: 'TBD',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`id` INTEGER AUTOINCREMENT, `name` VARCHAR(255), `surname` VARCHAR(255), UNIQUE `uniqueConstraint` (`name`, `surname`), PRIMARY KEY (`id`)) ENGINE=InnoDB;',
      postgres: 'CREATE TABLE IF NOT EXISTS "myTable" ("id" INTEGER AUTOINCREMENT, "name" VARCHAR(255), "surname" VARCHAR(255), CONSTRAINT "uniqueConstraint" UNIQUE ("name", "surname"), PRIMARY KEY ("id"));',
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([id] INTEGER AUTOINCREMENT, [name] VARCHAR(255), [surname] VARCHAR(255), CONSTRAINT [uniqueConstraint] UNIQUE ([name], [surname]), PRIMARY KEY ([id]));`,
      // SQLITE does not respect the index name when the index is created through CREATE TABLE
      // As such, Sequelize's createTable does not add the constraint in the Sequelize Dialect.
      // Instead, `sequelize.sync` calls CREATE INDEX after the table has been created,
      // as that query *does* respect the index name.
      sqlite: 'CREATE TABLE IF NOT EXISTS `myTable` (`id` INTEGER PRIMARY KEY AUTOINCREMENT, `name` VARCHAR(255), `surname` VARCHAR(255));',
      snowflake: 'CREATE TABLE IF NOT EXISTS "myTable" ("id" INTEGER AUTOINCREMENT, "name" VARCHAR(255), "surname" VARCHAR(255), UNIQUE "uniqueConstraint" ("name", "surname"), PRIMARY KEY ("id"));',
      db2: 'CREATE TABLE IF NOT EXISTS "myTable" ("id" INTEGER AUTOINCREMENT, "name" VARCHAR(255) NOT NULL, "surname" VARCHAR(255) NOT NULL, CONSTRAINT "uniqueConstraint" UNIQUE ("name", "surname"), PRIMARY KEY ("id"));',
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("id" INTEGER AUTOINCREMENT, "name" VARCHAR(255), "surname" VARCHAR(255),
        CONSTRAINT "uniqueConstraint" UNIQUE ("name", "surname"), PRIMARY KEY ("id")); END`,
    });
  });

  it('createTableQuery', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { foo1: 'INTEGER PRIMARY KEY NOT NULL', foo2: 'INTEGER PRIMARY KEY NOT NULL' }), {
      default: 'TBD',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`foo1` INTEGER NOT NULL, `foo2` INTEGER NOT NULL, PRIMARY KEY (`foo1`, `foo2`)) ENGINE=InnoDB;',
      postgres: 'CREATE TABLE IF NOT EXISTS "myTable" ("foo1" INTEGER NOT NULL, "foo2" INTEGER NOT NULL, PRIMARY KEY ("foo1","foo2"));',
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([foo1] INTEGER NOT NULL, [foo2] INTEGER NOT NULL, PRIMARY KEY ([foo1], [foo2]));`,
      sqlite: 'CREATE TABLE IF NOT EXISTS `myTable` (`foo1` INTEGER NOT NULL, `foo2` INTEGER NOT NULL, PRIMARY KEY (`foo1`, `foo2`));',
      snowflake: 'CREATE TABLE IF NOT EXISTS "myTable" ("foo1" INTEGER NOT NULL, "foo2" INTEGER NOT NULL, PRIMARY KEY ("foo1", "foo2"));',
      db2: 'CREATE TABLE IF NOT EXISTS "myTable" ("foo1" INTEGER NOT NULL, "foo2" INTEGER NOT NULL, PRIMARY KEY ("foo1", "foo2"));',
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("foo1" INTEGER NOT NULL, "foo2" INTEGER NOT NULL, PRIMARY KEY ("foo1", "foo2")); END`,
    });
  });

  it('createTableQuery with comments', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { int: 'INTEGER COMMENT Foo Bar', varchar: 'VARCHAR(50) UNIQUE COMMENT Bar Foo' }, {}), {
      default: 'TBD',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`int` INTEGER COMMENT Foo Bar, `varchar` VARCHAR(50) UNIQUE COMMENT Bar Foo) ENGINE=InnoDB;',
      postgres: `CREATE TABLE IF NOT EXISTS "myTable" ("int" INTEGER, "varchar" VARCHAR(50) UNIQUE); COMMENT ON COLUMN "myTable"."int" IS 'Foo Bar'; COMMENT ON COLUMN "myTable"."varchar" IS 'Bar Foo';`,
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([int] INTEGER, [varchar] VARCHAR(50) UNIQUE); EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Foo Bar',
        @level0type = N'Schema', @level0name = 'dbo', @level1type = N'Table', @level1name = [myTable], @level2type = N'Column', @level2name = [int]; EXEC sp_addextendedproperty @name = N'MS_Description',
        @value = N'Bar Foo', @level0type = N'Schema', @level0name = 'dbo', @level1type = N'Table', @level1name = [myTable], @level2type = N'Column', @level2name = [varchar];`,
      sqlite: 'CREATE TABLE IF NOT EXISTS `myTable` (`int` INTEGER COMMENT Foo Bar, `varchar` VARCHAR(50) UNIQUE COMMENT Bar Foo);',
      snowflake: 'CREATE TABLE IF NOT EXISTS "myTable" ("int" INTEGER COMMENT Foo Bar, "varchar" VARCHAR(50) UNIQUE COMMENT Bar Foo);',
      db2: `CREATE TABLE IF NOT EXISTS "myTable" ("int" INTEGER, "varchar" VARCHAR(50) UNIQUE); -- 'Foo Bar', TableName = "myTable", ColumnName = "int"; -- 'Bar Foo', TableName = "myTable", ColumnName = "varchar";`,
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("int" INTEGER COMMENT Foo Bar, "varchar" VARCHAR(50) UNIQUE COMMENT Bar Foo); END`,
    });
  });

  it('createTableQuery with comments and table object', () => {
    expectsql(queryGenerator.createTableQuery({ tableName: 'myTable' }, { int: 'INTEGER COMMENT Foo Bar', varchar: 'VARCHAR(50) UNIQUE COMMENT Bar Foo' }, {}), {
      default: 'TBD',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`int` INTEGER COMMENT Foo Bar, `varchar` VARCHAR(50) UNIQUE COMMENT Bar Foo) ENGINE=InnoDB;',
      postgres: `CREATE TABLE IF NOT EXISTS "myTable" ("int" INTEGER, "varchar" VARCHAR(50) UNIQUE); COMMENT ON COLUMN "myTable"."int" IS 'Foo Bar'; COMMENT ON COLUMN "myTable"."varchar" IS 'Bar Foo';`,
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([int] INTEGER, [varchar] VARCHAR(50) UNIQUE); EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Foo Bar',
        @level0type = N'Schema', @level0name = 'dbo', @level1type = N'Table', @level1name = [myTable], @level2type = N'Column', @level2name = [int]; EXEC sp_addextendedproperty @name = N'MS_Description',
        @value = N'Bar Foo', @level0type = N'Schema', @level0name = 'dbo', @level1type = N'Table', @level1name = [myTable], @level2type = N'Column', @level2name = [varchar];`,
      sqlite: 'CREATE TABLE IF NOT EXISTS `myTable` (`int` INTEGER COMMENT Foo Bar, `varchar` VARCHAR(50) UNIQUE COMMENT Bar Foo);',
      snowflake: 'CREATE TABLE IF NOT EXISTS "myTable" ("int" INTEGER COMMENT Foo Bar, "varchar" VARCHAR(50) UNIQUE COMMENT Bar Foo);',
      db2: `CREATE TABLE IF NOT EXISTS "myTable" ("int" INTEGER, "varchar" VARCHAR(50) UNIQUE); -- 'Foo Bar', TableName = "myTable", ColumnName = "int"; -- 'Bar Foo', TableName = "myTable", ColumnName = "varchar";`,
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("int" INTEGER COMMENT Foo Bar, "varchar" VARCHAR(50) UNIQUE COMMENT Bar Foo); END`,
    });
  });
});
