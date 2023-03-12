import { DataTypes } from '@sequelize/core';
import { expectsql, sequelize } from '../../support';

// TODO: overhaul this test suite when migrating createTableQuery to TypeScript
/**
 * Make methods stricter, throw when using invalid options
 * Accept and test for TableNameOrModel
 * Check if createTableQuery is typed correctly
 * Check if all tests make sense, the current tests are just copied from dialect specific tests and other expectations are added
 * Give tests better names
 * Make sure that all resulting queries are valid by adding integration tests for QueryInterface.createTable
 */

describe('QueryGenerator#createTableQuery', () => {
  const queryGenerator = sequelize.getQueryInterface().queryGenerator;

  it('produces a CREATE TABLE query with a single INTEGER attribute', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { int: 'INTEGER' }, {}), {
      default: 'CREATE TABLE IF NOT EXISTS [myTable] ([int] INTEGER);',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`int` INTEGER) ENGINE=InnoDB;',
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([int] INTEGER);`,
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("int" INTEGER); END`,
    });
  });

  it('produces a CREATE TABLE query with two VARCHAR attributes', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { title: 'VARCHAR(255)', name: 'VARCHAR(255)' }), {
      default: 'CREATE TABLE IF NOT EXISTS [myTable] ([title] VARCHAR(255), [name] VARCHAR(255));',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`title` VARCHAR(255), `name` VARCHAR(255)) ENGINE=InnoDB;',
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([title] VARCHAR(255), [name] VARCHAR(255));`,
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("title" VARCHAR(255), "name" VARCHAR(255)); END`,
    });
  });

  it('produces a CREATE TABLE query with two VARCHAR attributes and a TableNameWithSchema object', () => {
    expectsql(queryGenerator.createTableQuery({ tableName: 'myTable', schema: 'mySchema' }, { title: 'VARCHAR(255)', name: 'VARCHAR(255)' }), {
      default: 'CREATE TABLE IF NOT EXISTS [mySchema].[myTable] ([title] VARCHAR(255), [name] VARCHAR(255));',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `mySchema`.`myTable` (`title` VARCHAR(255), `name` VARCHAR(255)) ENGINE=InnoDB;',
      mssql: `IF OBJECT_ID(N'[mySchema].[myTable]', 'U') IS NULL CREATE TABLE [mySchema].[myTable] ([title] VARCHAR(255), [name] VARCHAR(255));`,
      sqlite: 'CREATE TABLE IF NOT EXISTS `mySchema.myTable` (`title` VARCHAR(255), `name` VARCHAR(255));',
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "mySchema"."myTable" ("title" VARCHAR(255), "name" VARCHAR(255)); END`,
    });
  });

  it('produces a CREATE TABLE query with three different INT attributes', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { int: 'INTEGER', bigint: 'BIGINT', smallint: 'SMALLINT' }), {
      default: 'CREATE TABLE IF NOT EXISTS [myTable] ([int] INTEGER, [bigint] BIGINT, [smallint] SMALLINT);',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`int` INTEGER, `bigint` BIGINT, `smallint` SMALLINT) ENGINE=InnoDB;',
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([int] INTEGER, [bigint] BIGINT, [smallint] SMALLINT);`,
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("int" INTEGER, "bigint" BIGINT, "smallint" SMALLINT); END`,
    });
  });

  it('produces a CREATE TABLE query with three different INT SERIAL attributes', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { serial: 'INTEGER SERIAL', bigserial: 'BIGINT SERIAL', smallserial: 'SMALLINT SERIAL' }), {
      default: 'CREATE TABLE IF NOT EXISTS [myTable] ([serial] INTEGER SERIAL, [bigserial] BIGINT SERIAL, [smallserial] SMALLINT SERIAL);',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`serial` INTEGER SERIAL, `bigserial` BIGINT SERIAL, `smallserial` SMALLINT SERIAL) ENGINE=InnoDB;',
      postgres: 'CREATE TABLE IF NOT EXISTS "myTable" ("serial" SERIAL, "bigserial" BIGSERIAL, "smallserial" SMALLSERIAL);',
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([serial] INTEGER SERIAL, [bigserial] BIGINT SERIAL, [smallserial] SMALLINT SERIAL);`,
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("serial" INTEGER SERIAL, "bigserial" BIGINT SERIAL, "smallserial" SMALLINT SERIAL); END`,
    });
  });

  it('produces a CREATE TABLE query with two INTEGER attributes with comments', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { int: 'INTEGER COMMENT Test', foo: 'INTEGER COMMENT Foo Comment' }), {
      default: 'CREATE TABLE IF NOT EXISTS [myTable] ([int] INTEGER COMMENT Test, [foo] INTEGER COMMENT Foo Comment);',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`int` INTEGER COMMENT Test, `foo` INTEGER COMMENT Foo Comment) ENGINE=InnoDB;',
      postgres: `CREATE TABLE IF NOT EXISTS "myTable" ("int" INTEGER , "foo" INTEGER ); COMMENT ON COLUMN "myTable"."int" IS 'Test'; COMMENT ON COLUMN "myTable"."foo" IS 'Foo Comment';`,
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([int] INTEGER, [foo] INTEGER); EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Test',
        @level0type = N'Schema', @level0name = 'dbo', @level1type = N'Table', @level1name = [myTable], @level2type = N'Column', @level2name = [int]; EXEC sp_addextendedproperty
        @name = N'MS_Description', @value = N'Foo Comment', @level0type = N'Schema', @level0name = 'dbo', @level1type = N'Table', @level1name = [myTable], @level2type = N'Column', @level2name = [foo];`,
      db2: `CREATE TABLE IF NOT EXISTS "myTable" ("int" INTEGER, "foo" INTEGER); -- 'Test', TableName = "myTable", ColumnName = "int"; -- 'Foo Comment', TableName = "myTable", ColumnName = "foo";`,
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("int" INTEGER COMMENT Test, "foo" INTEGER COMMENT Foo Comment); END`,
    });
  });

  it('produces a CREATE TABLE query with a BLOB attribute', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { data: 'BLOB' }), {
      default: 'CREATE TABLE IF NOT EXISTS [myTable] ([data] BLOB);',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`data` BLOB) ENGINE=InnoDB;',
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([data] BLOB);`,
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("data" BLOB); END`,
    });
  });

  it('produces a CREATE TABLE query with a LONGBLOB attribute', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { data: 'LONGBLOB' }), {
      default: 'CREATE TABLE IF NOT EXISTS [myTable] ([data] LONGBLOB);',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`data` LONGBLOB) ENGINE=InnoDB;',
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([data] LONGBLOB);`,
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("data" LONGBLOB); END`,
    });
  });

  it('produces a CREATE TABLE query with a BLOB(16M) attribute', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { data: 'BLOB(16M)' }), {
      default: 'CREATE TABLE IF NOT EXISTS [myTable] ([data] BLOB(16M));',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`data` BLOB(16M)) ENGINE=InnoDB;',
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([data] BLOB(16M));`,
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("data" BLOB(16M)); END`,
    });
  });

  it('produces a CREATE TABLE query with a normalized BLOB attribute', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { data: sequelize.normalizeDataType(DataTypes.BLOB).toSql() }), {
      default: 'CREATE TABLE IF NOT EXISTS [myTable] ([data] BLOB);',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`data` BLOB) ENGINE=InnoDB;',
      postgres: 'CREATE TABLE IF NOT EXISTS "myTable" ("data" BYTEA);',
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([data] VARBINARY(MAX));`,
      db2: 'CREATE TABLE IF NOT EXISTS "myTable" ("data" BLOB(1M));',
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("data" BLOB(1M)); END`,
    });
  });

  it('produces a CREATE TABLE query with a normalized long BLOB attribute', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { data: sequelize.normalizeDataType(DataTypes.BLOB('long')).toSql() }), {
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`data` LONGBLOB) ENGINE=InnoDB;',
      postgres: 'CREATE TABLE IF NOT EXISTS "myTable" ("data" BYTEA);',
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([data] VARBINARY(MAX));`,
      sqlite: 'CREATE TABLE IF NOT EXISTS `myTable` (`data` BLOB);',
      snowflake: 'CREATE TABLE IF NOT EXISTS "myTable" ("data" LONGBLOB);',
      db2: 'CREATE TABLE IF NOT EXISTS "myTable" ("data" BLOB(2G));',
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("data" BLOB(2G)); END`,
    });
  });

  it('produces a CREATE TABLE query with an ENUM and a VARCHAR attribute', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { title: 'ENUM("A", "B", "C")', name: 'VARCHAR(255)' }), {
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`title` ENUM("A", "B", "C"), `name` VARCHAR(255)) ENGINE=InnoDB;',
      postgres: 'CREATE TABLE IF NOT EXISTS "myTable" ("title" "public"."enum_myTable_title", "name" VARCHAR(255));',
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([title] ENUM("A", "B", "C"), [name] VARCHAR(255));`,
      sqlite: 'CREATE TABLE IF NOT EXISTS `myTable` (`title` ENUM("A", "B", "C"), `name` VARCHAR(255));',
      'snowflake db2': 'CREATE TABLE IF NOT EXISTS "myTable" ("title" ENUM("A", "B", "C"), "name" VARCHAR(255));',
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("title" ENUM("A", "B", "C"), "name" VARCHAR(255)); END`,
    });
  });

  it('produces a CREATE TABLE query with two VARCHAR attributes with specified engine', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { title: 'VARCHAR(255)', name: 'VARCHAR(255)' }, { engine: 'MyISAM' }), {
      default: 'CREATE TABLE IF NOT EXISTS [myTable] ([title] VARCHAR(255), [name] VARCHAR(255));',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`title` VARCHAR(255), `name` VARCHAR(255)) ENGINE=MyISAM;',
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([title] VARCHAR(255), [name] VARCHAR(255));`,
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("title" VARCHAR(255), "name" VARCHAR(255)); END`,
    });
  });

  it('produces a CREATE TABLE query with two VARCHAR attributes with specified charset and collation', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { title: 'VARCHAR(255)', name: 'VARCHAR(255)' }, { charset: 'utf8', collate: 'utf8_unicode_ci' }), {
      default: 'CREATE TABLE IF NOT EXISTS [myTable] ([title] VARCHAR(255), [name] VARCHAR(255));',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`title` VARCHAR(255), `name` VARCHAR(255)) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE utf8_unicode_ci;',
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([title] VARCHAR(255), [name] VARCHAR(255));`,
      snowflake: 'CREATE TABLE IF NOT EXISTS "myTable" ("title" VARCHAR(255), "name" VARCHAR(255)) DEFAULT CHARSET=utf8 COLLATE utf8_unicode_ci;',
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("title" VARCHAR(255), "name" VARCHAR(255)); END`,
    });
  });

  it('produces a CREATE TABLE query with two VARCHAR attributes with specified charset', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { title: 'VARCHAR(255)', name: 'VARCHAR(255)' }, { charset: 'latin1' }), {
      default: 'CREATE TABLE IF NOT EXISTS [myTable] ([title] VARCHAR(255), [name] VARCHAR(255));',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`title` VARCHAR(255), `name` VARCHAR(255)) ENGINE=InnoDB DEFAULT CHARSET=latin1;',
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([title] VARCHAR(255), [name] VARCHAR(255));`,
      snowflake: 'CREATE TABLE IF NOT EXISTS "myTable" ("title" VARCHAR(255), "name" VARCHAR(255)) DEFAULT CHARSET=latin1;',
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("title" VARCHAR(255), "name" VARCHAR(255)); END`,
    });
  });

  it('produces a CREATE TABLE query with an ENUM and a VARCHAR attribute with specified charset', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { title: 'ENUM("A", "B", "C")', name: 'VARCHAR(255)' }, { charset: 'latin1' }), {
      default: 'CREATE TABLE IF NOT EXISTS [myTable] ([title] ENUM("A", "B", "C"), [name] VARCHAR(255));',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`title` ENUM("A", "B", "C"), `name` VARCHAR(255)) ENGINE=InnoDB DEFAULT CHARSET=latin1;',
      postgres: 'CREATE TABLE IF NOT EXISTS "myTable" ("title" "public"."enum_myTable_title", "name" VARCHAR(255));',
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([title] ENUM("A", "B", "C"), [name] VARCHAR(255));`,
      snowflake: 'CREATE TABLE IF NOT EXISTS "myTable" ("title" ENUM("A", "B", "C"), "name" VARCHAR(255)) DEFAULT CHARSET=latin1;',
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("title" ENUM("A", "B", "C"), "name" VARCHAR(255)); END`,
    });
  });

  it('produces a CREATE TABLE query with two VARCHAR attributes with specified row format', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { title: 'VARCHAR(255)', name: 'VARCHAR(255)' }, { rowFormat: 'default' }), {
      default: 'CREATE TABLE IF NOT EXISTS [myTable] ([title] VARCHAR(255), [name] VARCHAR(255));',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`title` VARCHAR(255), `name` VARCHAR(255)) ENGINE=InnoDB ROW_FORMAT=default;',
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([title] VARCHAR(255), [name] VARCHAR(255));`,
      snowflake: 'CREATE TABLE IF NOT EXISTS "myTable" ("title" VARCHAR(255), "name" VARCHAR(255)) ROW_FORMAT=default;',
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("title" VARCHAR(255), "name" VARCHAR(255)); END`,
    });
  });

  it('produces a CREATE TABLE query with two VARCHAR and a primary key INTEGER attribute', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { title: 'VARCHAR(255)', name: 'VARCHAR(255)', id: 'INTEGER PRIMARY KEY' }), {
      default: 'CREATE TABLE IF NOT EXISTS "myTable" ("title" VARCHAR(255), "name" VARCHAR(255), "id" INTEGER , PRIMARY KEY ("id"));',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`title` VARCHAR(255), `name` VARCHAR(255), `id` INTEGER , PRIMARY KEY (`id`)) ENGINE=InnoDB;',
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([title] VARCHAR(255), [name] VARCHAR(255), [id] INTEGER, PRIMARY KEY ([id]));`,
      sqlite: 'CREATE TABLE IF NOT EXISTS `myTable` (`title` VARCHAR(255), `name` VARCHAR(255), `id` INTEGER PRIMARY KEY);',
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("title" VARCHAR(255), "name" VARCHAR(255), "id" INTEGER, PRIMARY KEY ("id")); END`,
    });
  });

  it('produces a CREATE TABLE query with two VARCHAR and a complex INTEGER attribute (no quotes)', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { title: 'VARCHAR(255)', name: 'VARCHAR(255)', otherId: 'INTEGER REFERENCES otherTable (id) ON DELETE CASCADE ON UPDATE NO ACTION' }), {
      default: 'CREATE TABLE IF NOT EXISTS [myTable] ([title] VARCHAR(255), [name] VARCHAR(255), [otherId] INTEGER REFERENCES otherTable (id) ON DELETE CASCADE ON UPDATE NO ACTION);',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`title` VARCHAR(255), `name` VARCHAR(255), `otherId` INTEGER, FOREIGN KEY (`otherId`) REFERENCES otherTable (id) ON DELETE CASCADE ON UPDATE NO ACTION) ENGINE=InnoDB;',
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([title] VARCHAR(255), [name] VARCHAR(255), [otherId] INTEGER, FOREIGN KEY ([otherId]) REFERENCES otherTable (id) ON DELETE CASCADE ON UPDATE NO ACTION);`,
      'snowflake db2': 'CREATE TABLE IF NOT EXISTS "myTable" ("title" VARCHAR(255), "name" VARCHAR(255), "otherId" INTEGER, FOREIGN KEY ("otherId") REFERENCES otherTable (id) ON DELETE CASCADE ON UPDATE NO ACTION);',
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("title" VARCHAR(255), "name" VARCHAR(255), "otherId" INTEGER REFERENCES otherTable (id) ON DELETE CASCADE ON UPDATE NO ACTION); END`,
    });
  });

  it('produces a CREATE TABLE query with two VARCHAR and a complex INTEGER attribute (double quotes)', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { title: 'VARCHAR(255)', name: 'VARCHAR(255)', otherId: 'INTEGER REFERENCES "otherTable" ("id") ON DELETE CASCADE ON UPDATE NO ACTION' }), {
      default: 'CREATE TABLE IF NOT EXISTS [myTable] ([title] VARCHAR(255), [name] VARCHAR(255), [otherId] INTEGER REFERENCES "otherTable" ("id") ON DELETE CASCADE ON UPDATE NO ACTION);',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`title` VARCHAR(255), `name` VARCHAR(255), `otherId` INTEGER, FOREIGN KEY (`otherId`) REFERENCES "otherTable" ("id") ON DELETE CASCADE ON UPDATE NO ACTION) ENGINE=InnoDB;',
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([title] VARCHAR(255), [name] VARCHAR(255), [otherId] INTEGER, FOREIGN KEY ([otherId]) REFERENCES "otherTable" ("id") ON DELETE CASCADE ON UPDATE NO ACTION);`,
      'snowflake db2': 'CREATE TABLE IF NOT EXISTS "myTable" ("title" VARCHAR(255), "name" VARCHAR(255), "otherId" INTEGER, FOREIGN KEY ("otherId") REFERENCES "otherTable" ("id") ON DELETE CASCADE ON UPDATE NO ACTION);',
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("title" VARCHAR(255), "name" VARCHAR(255), "otherId" INTEGER REFERENCES "otherTable" ("id") ON DELETE CASCADE ON UPDATE NO ACTION); END`,
    });
  });

  it('produces a CREATE TABLE query with two VARCHAR and a complex INTEGER attribute (backtick quotes)', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { title: 'VARCHAR(255)', name: 'VARCHAR(255)', otherId: 'INTEGER REFERENCES `otherTable` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION' }), {
      default: 'CREATE TABLE IF NOT EXISTS [myTable] ([title] VARCHAR(255), [name] VARCHAR(255), [otherId] INTEGER REFERENCES `otherTable` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION);',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`title` VARCHAR(255), `name` VARCHAR(255), `otherId` INTEGER, FOREIGN KEY (`otherId`) REFERENCES `otherTable` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION) ENGINE=InnoDB;',
      mssql: 'IF OBJECT_ID(N\'[myTable]\', \'U\') IS NULL CREATE TABLE [myTable] ([title] VARCHAR(255), [name] VARCHAR(255), [otherId] INTEGER, FOREIGN KEY ([otherId]) REFERENCES `otherTable` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION);',
      'snowflake db2': 'CREATE TABLE IF NOT EXISTS "myTable" ("title" VARCHAR(255), "name" VARCHAR(255), "otherId" INTEGER, FOREIGN KEY ("otherId") REFERENCES `otherTable` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION);',
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("title" VARCHAR(255), "name" VARCHAR(255), "otherId" INTEGER REFERENCES \`otherTable\` (\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION); END`,
    });
  });

  it('produces a CREATE TABLE query with two VARCHAR attributes with specified unique keys', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { title: 'VARCHAR(255)', name: 'VARCHAR(255)' }, { uniqueKeys: [{ fields: ['title', 'name'] }] }), {
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`title` VARCHAR(255), `name` VARCHAR(255), UNIQUE `uniq_myTable_title_name` (`title`, `name`)) ENGINE=InnoDB;',
      postgres: 'CREATE TABLE IF NOT EXISTS "myTable" ("title" VARCHAR(255), "name" VARCHAR(255), CONSTRAINT "my_table_title_name" UNIQUE ("title", "name"));',
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([title] VARCHAR(255), [name] VARCHAR(255), CONSTRAINT [my_table_title_name] UNIQUE ([title], [name]));`,
      sqlite: 'CREATE TABLE IF NOT EXISTS `myTable` (`title` VARCHAR(255), `name` VARCHAR(255));',
      snowflake: 'CREATE TABLE IF NOT EXISTS "myTable" ("title" VARCHAR(255), "name" VARCHAR(255), UNIQUE "uniq_myTable_title_name" ("title", "name"));',
      db2: 'CREATE TABLE IF NOT EXISTS "myTable" ("title" VARCHAR(255) NOT NULL, "name" VARCHAR(255) NOT NULL, CONSTRAINT "uniq_myTable_title_name" UNIQUE ("title", "name"));',
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("title" VARCHAR(255), "name" VARCHAR(255), CONSTRAINT "uniq_myTable_title_name" UNIQUE ("title", "name")); END`,
    });
  });

  it('produces a CREATE TABLE query with an auto-incremented INTEGER with specified initial auto increment', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { id: 'INTEGER auto_increment PRIMARY KEY' }, { initialAutoIncrement: 1_000_001 }), {
      default: 'CREATE TABLE IF NOT EXISTS [myTable] ([id] INTEGER auto_increment, PRIMARY KEY ([id]));',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`id` INTEGER auto_increment , PRIMARY KEY (`id`)) ENGINE=InnoDB AUTO_INCREMENT=1000001;',
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([id] INTEGER auto_increment, PRIMARY KEY ([id]));`,
      sqlite: 'CREATE TABLE IF NOT EXISTS `myTable` (`id` INTEGER PRIMARY KEY);',
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("id" INTEGER auto_increment, PRIMARY KEY ("id")); END`,
    });
  });

  it('produces a CREATE TABLE query with a BINARY VARCHAR attribute and a unsigned primary key INTEGER with specified length', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { title: 'VARCHAR BINARY(255)', number: 'INTEGER(5) UNSIGNED PRIMARY KEY ' }), {
      default: 'CREATE TABLE IF NOT EXISTS [myTable] ([title] VARCHAR BINARY(255), [number] INTEGER(5) UNSIGNED, PRIMARY KEY ([number]));',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`title` VARCHAR BINARY(255), `number` INTEGER(5) UNSIGNED, PRIMARY KEY (`number`)) ENGINE=InnoDB;',
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([title] VARCHAR BINARY(255), [number] INTEGER(5) UNSIGNED, PRIMARY KEY ([number]));`,
      // length and unsigned are not allowed on primary key for sqlite
      sqlite: 'CREATE TABLE IF NOT EXISTS `myTable` (`title` VARCHAR BINARY(255), `number` INTEGER PRIMARY KEY);',
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("title" VARCHAR BINARY(255), "number" INTEGER(5) UNSIGNED, PRIMARY KEY ("number")); END`,
    });
  });

  it('produces a CREATE TABLE query with a VARCHAR attribute and a auto-incremented primary key INTEGER', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { id: 'INTEGER PRIMARY KEY AUTOINCREMENT', name: 'VARCHAR(255)' }), {
      default: 'CREATE TABLE IF NOT EXISTS [myTable] ([id] INTEGER AUTOINCREMENT, [name] VARCHAR(255), PRIMARY KEY ([id]));',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`id` INTEGER AUTOINCREMENT, `name` VARCHAR(255), PRIMARY KEY (`id`)) ENGINE=InnoDB;',
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([id] INTEGER AUTOINCREMENT, [name] VARCHAR(255), PRIMARY KEY ([id]));`,
      sqlite: 'CREATE TABLE IF NOT EXISTS `myTable` (`id` INTEGER PRIMARY KEY AUTOINCREMENT, `name` VARCHAR(255));',
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("id" INTEGER AUTOINCREMENT, "name" VARCHAR(255), PRIMARY KEY ("id")); END`,
    });
  });

  it('produces a CREATE TABLE query with a VARCHAR attribute and a auto-incremented primary key INTEGER with specified length', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { id: 'INTEGER(4) PRIMARY KEY AUTOINCREMENT', name: 'VARCHAR(255)' }), {
      default: 'CREATE TABLE IF NOT EXISTS [myTable] ([id] INTEGER(4) AUTOINCREMENT, [name] VARCHAR(255), PRIMARY KEY ([id]));',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`id` INTEGER(4) AUTOINCREMENT, `name` VARCHAR(255), PRIMARY KEY (`id`)) ENGINE=InnoDB;',
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([id] INTEGER(4) AUTOINCREMENT, [name] VARCHAR(255), PRIMARY KEY ([id]));`,
      sqlite: 'CREATE TABLE IF NOT EXISTS `myTable` (`id` INTEGER PRIMARY KEY AUTOINCREMENT, `name` VARCHAR(255));',
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("id" INTEGER(4) AUTOINCREMENT, "name" VARCHAR(255), PRIMARY KEY ("id")); END`,
    });
  });

  it('produces a CREATE TABLE query with a VARCHAR attribute and a auto-incremented primary key SMALLINT with specified length', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { id: 'SMALLINT(4) PRIMARY KEY AUTOINCREMENT UNSIGNED', name: 'VARCHAR(255)' }), {
      default: 'CREATE TABLE IF NOT EXISTS [myTable] ([id] SMALLINT(4) AUTOINCREMENT UNSIGNED, [name] VARCHAR(255), PRIMARY KEY ([id]));',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`id` SMALLINT(4) AUTOINCREMENT UNSIGNED, `name` VARCHAR(255), PRIMARY KEY (`id`)) ENGINE=InnoDB;',
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([id] SMALLINT(4) AUTOINCREMENT UNSIGNED, [name] VARCHAR(255), PRIMARY KEY ([id]));`,
      sqlite: 'CREATE TABLE IF NOT EXISTS `myTable` (`id` INTEGER PRIMARY KEY AUTOINCREMENT, `name` VARCHAR(255));',
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("id" SMALLINT(4) AUTOINCREMENT UNSIGNED, "name" VARCHAR(255), PRIMARY KEY ("id")); END`,
    });
  });

  it('produces a CREATE TABLE query with two VARCHAR attributes and a auto-incremented primary key INTEGER with specified unique contraints', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { id: 'INTEGER PRIMARY KEY AUTOINCREMENT', name: 'VARCHAR(255)', surname: 'VARCHAR(255)' }, { uniqueKeys: { uniqueConstraint: { fields: ['name', 'surname'] } } }), {
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

  it('produces a CREATE TABLE query with two not-null primary key INTEGER attributes', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { foo1: 'INTEGER PRIMARY KEY NOT NULL', foo2: 'INTEGER PRIMARY KEY NOT NULL' }), {
      default: 'CREATE TABLE IF NOT EXISTS [myTable] ([foo1] INTEGER NOT NULL, [foo2] INTEGER NOT NULL, PRIMARY KEY ([foo1], [foo2]));',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`foo1` INTEGER NOT NULL, `foo2` INTEGER NOT NULL, PRIMARY KEY (`foo1`, `foo2`)) ENGINE=InnoDB;',
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([foo1] INTEGER NOT NULL, [foo2] INTEGER NOT NULL, PRIMARY KEY ([foo1], [foo2]));`,
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("foo1" INTEGER NOT NULL, "foo2" INTEGER NOT NULL, PRIMARY KEY ("foo1", "foo2")); END`,
    });
  });

  it('produces a CREATE TABLE query with an INTEGER and a VARCHAR attributes, both with comments', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { int: 'INTEGER COMMENT Foo Bar', varchar: 'VARCHAR(50) UNIQUE COMMENT Bar Foo' }, {}), {
      default: 'CREATE TABLE IF NOT EXISTS [myTable] ([int] INTEGER COMMENT Foo Bar, [varchar] VARCHAR(50) UNIQUE COMMENT Bar Foo);',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`int` INTEGER COMMENT Foo Bar, `varchar` VARCHAR(50) UNIQUE COMMENT Bar Foo) ENGINE=InnoDB;',
      postgres: `CREATE TABLE IF NOT EXISTS "myTable" ("int" INTEGER, "varchar" VARCHAR(50) UNIQUE); COMMENT ON COLUMN "myTable"."int" IS 'Foo Bar'; COMMENT ON COLUMN "myTable"."varchar" IS 'Bar Foo';`,
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([int] INTEGER, [varchar] VARCHAR(50) UNIQUE); EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Foo Bar',
        @level0type = N'Schema', @level0name = 'dbo', @level1type = N'Table', @level1name = [myTable], @level2type = N'Column', @level2name = [int]; EXEC sp_addextendedproperty @name = N'MS_Description',
        @value = N'Bar Foo', @level0type = N'Schema', @level0name = 'dbo', @level1type = N'Table', @level1name = [myTable], @level2type = N'Column', @level2name = [varchar];`,
      db2: `CREATE TABLE IF NOT EXISTS "myTable" ("int" INTEGER, "varchar" VARCHAR(50) UNIQUE); -- 'Foo Bar', TableName = "myTable", ColumnName = "int"; -- 'Bar Foo', TableName = "myTable", ColumnName = "varchar";`,
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("int" INTEGER COMMENT Foo Bar, "varchar" VARCHAR(50) UNIQUE COMMENT Bar Foo); END`,
    });
  });

  it('produces a CREATE TABLE query with an INTEGER and a VARCHAR attributes, both with comments, with a table name in tableName object', () => {
    expectsql(queryGenerator.createTableQuery({ tableName: 'myTable' }, { int: 'INTEGER COMMENT Foo Bar', varchar: 'VARCHAR(50) UNIQUE COMMENT Bar Foo' }, {}), {
      default: 'CREATE TABLE IF NOT EXISTS [myTable] ([int] INTEGER COMMENT Foo Bar, [varchar] VARCHAR(50) UNIQUE COMMENT Bar Foo);',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`int` INTEGER COMMENT Foo Bar, `varchar` VARCHAR(50) UNIQUE COMMENT Bar Foo) ENGINE=InnoDB;',
      postgres: `CREATE TABLE IF NOT EXISTS "myTable" ("int" INTEGER, "varchar" VARCHAR(50) UNIQUE); COMMENT ON COLUMN "myTable"."int" IS 'Foo Bar'; COMMENT ON COLUMN "myTable"."varchar" IS 'Bar Foo';`,
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([int] INTEGER, [varchar] VARCHAR(50) UNIQUE); EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Foo Bar',
        @level0type = N'Schema', @level0name = 'dbo', @level1type = N'Table', @level1name = [myTable], @level2type = N'Column', @level2name = [int]; EXEC sp_addextendedproperty @name = N'MS_Description',
        @value = N'Bar Foo', @level0type = N'Schema', @level0name = 'dbo', @level1type = N'Table', @level1name = [myTable], @level2type = N'Column', @level2name = [varchar];`,
      db2: `CREATE TABLE IF NOT EXISTS "myTable" ("int" INTEGER, "varchar" VARCHAR(50) UNIQUE); -- 'Foo Bar', TableName = "myTable", ColumnName = "int"; -- 'Bar Foo', TableName = "myTable", ColumnName = "varchar";`,
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("int" INTEGER COMMENT Foo Bar, "varchar" VARCHAR(50) UNIQUE COMMENT Bar Foo); END`,
    });
  });
});
