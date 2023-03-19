import { createSequelizeInstance, expectsql, sequelize } from '../../support';

const dialect = sequelize.dialect;

// TODO: check the tests with COMMENT after attributeToSQL quotes the comment
// TODO: double check if all column SQL types are possible results of attributeToSQL after #15533 has been merged
// TODO: see if some logic in handling columns can be moved to attributeToSQL which could make some tests here redundant

describe('QueryGenerator#createTableQuery', () => {
  const queryGenerator = sequelize.getQueryInterface().queryGenerator;

  it('produces a query to create a table', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { myColumn: 'DATE' }), {
      default: 'CREATE TABLE IF NOT EXISTS [myTable] ([myColumn] DATE);',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`myColumn` DATE) ENGINE=InnoDB;',
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([myColumn] DATE);`,
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("myColumn" DATE); END`,
    });
  });

  it('produces a query to create a table from a model', () => {
    const MyModel = sequelize.define('myModel', {});

    expectsql(queryGenerator.createTableQuery(MyModel, { myColumn: 'DATE' }), {
      default: 'CREATE TABLE IF NOT EXISTS [myModels] ([myColumn] DATE);',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myModels` (`myColumn` DATE) ENGINE=InnoDB;',
      mssql: `IF OBJECT_ID(N'[myModels]', 'U') IS NULL CREATE TABLE [myModels] ([myColumn] DATE);`,
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myModels" ("myColumn" DATE); END`,
    });
  });

  it('produces a query to create a table with schema in tableName object', () => {
    expectsql(queryGenerator.createTableQuery({ tableName: 'myTable', schema: 'mySchema' }, { myColumn: 'DATE' }), {
      default: 'CREATE TABLE IF NOT EXISTS [mySchema].[myTable] ([myColumn] DATE);',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `mySchema`.`myTable` (`myColumn` DATE) ENGINE=InnoDB;',
      mssql: `IF OBJECT_ID(N'[mySchema].[myTable]', 'U') IS NULL CREATE TABLE [mySchema].[myTable] ([myColumn] DATE);`,
      sqlite: 'CREATE TABLE IF NOT EXISTS `mySchema.myTable` (`myColumn` DATE);',
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "mySchema"."myTable" ("myColumn" DATE); END`,
    });
  });

  it('produces a query to create a table with default schema in tableName object', () => {
    expectsql(queryGenerator.createTableQuery({ tableName: 'myTable', schema: dialect.getDefaultSchema() }, { myColumn: 'DATE' }), {
      default: 'CREATE TABLE IF NOT EXISTS [myTable] ([myColumn] DATE);',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`myColumn` DATE) ENGINE=InnoDB;',
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([myColumn] DATE);`,
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("myColumn" DATE); END`,
    });
  });

  it('produces a query to create a table from a table and globally set schema', () => {
    const sequelizeSchema = createSequelizeInstance({ schema: 'mySchema' });
    const queryGeneratorSchema = sequelizeSchema.getQueryInterface().queryGenerator;

    expectsql(queryGeneratorSchema.createTableQuery('myTable', { myColumn: 'DATE' }), {
      default: 'CREATE TABLE IF NOT EXISTS [mySchema].[myTable] ([myColumn] DATE);',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `mySchema`.`myTable` (`myColumn` DATE) ENGINE=InnoDB;',
      mssql: `IF OBJECT_ID(N'[mySchema].[myTable]', 'U') IS NULL CREATE TABLE [mySchema].[myTable] ([myColumn] DATE);`,
      sqlite: 'CREATE TABLE IF NOT EXISTS `mySchema.myTable` (`myColumn` DATE);',
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "mySchema"."myTable" ("myColumn" DATE); END`,
    });
  });

  it('produces a query to create a table with schema and delimiter in tableName object', () => {
    // This test is only relevant for dialects that do not support schemas
    if (dialect.supports.schemas) {
      return;
    }

    expectsql(queryGenerator.createTableQuery({ tableName: 'myTable', schema: 'mySchema', delimiter: 'custom' }, { myColumn: 'DATE' }), {
      sqlite: 'CREATE TABLE IF NOT EXISTS `mySchemacustommyTable` (`myColumn` DATE);',
    });
  });

  it('produces a query to create a table with multiple columns', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { myColumn: 'DATE', secondColumn: 'TEXT' }), {
      default: 'CREATE TABLE IF NOT EXISTS [myTable] ([myColumn] DATE, [secondColumn] TEXT);',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`myColumn` DATE, `secondColumn` TEXT) ENGINE=InnoDB;',
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([myColumn] DATE, [secondColumn] TEXT);`,
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("myColumn" DATE, "secondColumn" TEXT); END`,
    });
  });

  it('produces a query to create a table with a primary key', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { myColumn: 'DATE PRIMARY KEY' }), {
      default: 'CREATE TABLE IF NOT EXISTS [myTable] ([myColumn] DATE, PRIMARY KEY ([myColumn]));',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`myColumn` DATE, PRIMARY KEY (`myColumn`)) ENGINE=InnoDB;',
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([myColumn] DATE, PRIMARY KEY ([myColumn]));`,
      sqlite: 'CREATE TABLE IF NOT EXISTS `myTable` (`myColumn` DATE PRIMARY KEY);',
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("myColumn" DATE, PRIMARY KEY ("myColumn")); END`,
    });
  });

  it('produces a query to create a table with multiple primary keys', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { myColumn: 'DATE PRIMARY KEY', secondColumn: 'TEXT PRIMARY KEY' }), {
      default: 'CREATE TABLE IF NOT EXISTS [myTable] ([myColumn] DATE, [secondColumn] TEXT, PRIMARY KEY ([myColumn], [secondColumn]));',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`myColumn` DATE, `secondColumn` TEXT, PRIMARY KEY (`myColumn`, `secondColumn`)) ENGINE=InnoDB;',
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([myColumn] DATE, [secondColumn] TEXT, PRIMARY KEY ([myColumn], [secondColumn]));`,
      sqlite: 'CREATE TABLE IF NOT EXISTS `myTable` (`myColumn` DATE NOT NULL, `secondColumn` TEXT NOT NULL, PRIMARY KEY (`myColumn`, `secondColumn`));',
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("myColumn" DATE, "secondColumn" TEXT, PRIMARY KEY ("myColumn", "secondColumn")); END`,
    });
  });

  // quoting the identifiers after REFERENCES is done by attributesToSQL
  it('produces a query to create a table with references', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { myColumn: 'DATE REFERENCES "Bar" ("id")' }), {
      default: 'CREATE TABLE IF NOT EXISTS [myTable] ([myColumn] DATE REFERENCES "Bar" ("id"));',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`myColumn` DATE, FOREIGN KEY (`myColumn`) REFERENCES "Bar" ("id")) ENGINE=InnoDB;',
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([myColumn] DATE, FOREIGN KEY ([myColumn]) REFERENCES "Bar" ("id"));`,
      'snowflake db2': 'CREATE TABLE IF NOT EXISTS "myTable" ("myColumn" DATE, FOREIGN KEY ("myColumn") REFERENCES "Bar" ("id"));',
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("myColumn" DATE REFERENCES "Bar" ("id")); END`,
    });
  });

  it('produces a query to create a table with references and a primary key', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { myColumn: 'DATE PRIMARY KEY REFERENCES "Bar" ("id")' }), {
      default: 'CREATE TABLE IF NOT EXISTS [myTable] ([myColumn] DATE REFERENCES "Bar" ("id"), PRIMARY KEY ("myColumn"));',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`myColumn` DATE, PRIMARY KEY (`myColumn`), FOREIGN KEY (`myColumn`) REFERENCES "Bar" ("id")) ENGINE=InnoDB;',
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([myColumn] DATE, PRIMARY KEY ([myColumn]), FOREIGN KEY ([myColumn]) REFERENCES "Bar" ("id"));`,
      sqlite: 'CREATE TABLE IF NOT EXISTS `myTable` (`myColumn` DATE PRIMARY KEY REFERENCES "Bar" ("id"));',
      'snowflake db2': 'CREATE TABLE IF NOT EXISTS "myTable" ("myColumn" DATE, PRIMARY KEY ("myColumn"), FOREIGN KEY ("myColumn") REFERENCES "Bar" ("id"));',
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("myColumn" DATE REFERENCES "Bar" ("id"), PRIMARY KEY ("myColumn")); END`,
    });
  });

  // TODO: REFERENCES should be pushed to the end, this is likely a bug in mysql/mariadb
  //       mssql and db2 use the same logic but there does not seem to be a valid attributeToSQL result that causes issues
  it('produces a query to create a table with references and a comment', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { myColumn: 'DATE REFERENCES "Bar" ("id") COMMENT Foo' }), {
      default: 'CREATE TABLE IF NOT EXISTS [myTable] ([myColumn] DATE REFERENCES "Bar" ("id") COMMENT Foo);',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`myColumn` DATE, FOREIGN KEY (`myColumn`) REFERENCES "Bar" ("id") COMMENT Foo) ENGINE=InnoDB;',
      postgres: `CREATE TABLE IF NOT EXISTS "myTable" ("myColumn" DATE REFERENCES "Bar" ("id")); COMMENT ON COLUMN "myTable"."myColumn" IS 'Foo';`,
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([myColumn] DATE, FOREIGN KEY ([myColumn]) REFERENCES "Bar" ("id"));
        EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Foo', @level0type = N'Schema', @level0name = 'dbo',
        @level1type = N'Table', @level1name = [myTable], @level2type = N'Column', @level2name = [myColumn];`,
      snowflake: 'CREATE TABLE IF NOT EXISTS "myTable" ("myColumn" DATE, FOREIGN KEY ("myColumn") REFERENCES "Bar" ("id") COMMENT Foo);',
      db2: `CREATE TABLE IF NOT EXISTS "myTable" ("myColumn" DATE, FOREIGN KEY ("myColumn") REFERENCES "Bar" ("id")); -- 'Foo', TableName = "myTable", ColumnName = "myColumn";`,
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("myColumn" DATE REFERENCES "Bar" ("id") COMMENT Foo); END`,
    });
  });

  it('produces a query to create a table with a non-null column', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { myColumn: 'DATE NOT NULL' }), {
      default: 'CREATE TABLE IF NOT EXISTS [myTable] ([myColumn] DATE NOT NULL);',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`myColumn` DATE NOT NULL) ENGINE=InnoDB;',
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([myColumn] DATE NOT NULL);`,
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("myColumn" DATE NOT NULL); END`,
    });
  });

  it('produces a query to create a table with multiple columns with comments', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { myColumn: 'DATE COMMENT Foo', secondColumn: 'DATE COMMENT Foo Bar' }), {
      default: 'CREATE TABLE IF NOT EXISTS [myTable] ([myColumn] DATE COMMENT Foo, [secondColumn] DATE COMMENT Foo Bar);',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`myColumn` DATE COMMENT Foo, `secondColumn` DATE COMMENT Foo Bar) ENGINE=InnoDB;',
      postgres: `CREATE TABLE IF NOT EXISTS "myTable" ("myColumn" DATE, "secondColumn" DATE); COMMENT ON COLUMN "myTable"."myColumn" IS 'Foo'; COMMENT ON COLUMN "myTable"."secondColumn" IS 'Foo Bar';`,
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([myColumn] DATE, [secondColumn] DATE);
        EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Foo', @level0type = N'Schema', @level0name = 'dbo',
        @level1type = N'Table', @level1name = [myTable], @level2type = N'Column', @level2name = [myColumn];
        EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Foo Bar', @level0type = N'Schema', @level0name = 'dbo',
        @level1type = N'Table', @level1name = [myTable], @level2type = N'Column', @level2name = [secondColumn];`,
      db2: `CREATE TABLE IF NOT EXISTS "myTable" ("myColumn" DATE, "secondColumn" DATE); -- 'Foo', TableName = "myTable", ColumnName = "myColumn"; -- 'Foo Bar', TableName = "myTable", ColumnName = "secondColumn";`,
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("myColumn" DATE COMMENT Foo, "secondColumn" DATE COMMENT Foo Bar); END`,
    });
  });

  // TODO: the second COMMENT should likely be replaced by an empty string in DB2 and MSSQL
  it('produces a query to create a table with multiple comments in one column', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { myColumn: 'DATE COMMENT Foo COMMENT Bar' }), {
      default: 'CREATE TABLE IF NOT EXISTS [myTable] ([myColumn] DATE COMMENT Foo COMMENT Bar);',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`myColumn` DATE COMMENT Foo COMMENT Bar) ENGINE=InnoDB;',
      postgres: `CREATE TABLE IF NOT EXISTS "myTable" ("myColumn" DATE); COMMENT ON COLUMN "myTable"."myColumn" IS 'Foo COMMENT Bar';`,
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([myColumn] DATE COMMENT Foo);
        EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Bar', @level0type = N'Schema', @level0name = 'dbo',
        @level1type = N'Table', @level1name = [myTable], @level2type = N'Column', @level2name = [myColumn];`,
      db2: `CREATE TABLE IF NOT EXISTS "myTable" ("myColumn" DATE COMMENT Foo); -- 'Bar', TableName = "myTable", ColumnName = "myColumn";`,
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("myColumn" DATE COMMENT Foo COMMENT Bar); END`,
    });
  });

  it('produces a query to create a table with a primary key specified after the comment', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { myColumn: 'DATE COMMENT Foo PRIMARY KEY' }), {
      default: 'CREATE TABLE IF NOT EXISTS [myTable] ([myColumn] DATE COMMENT Foo, PRIMARY KEY ([myColumn]));',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`myColumn` DATE COMMENT Foo, PRIMARY KEY (`myColumn`)) ENGINE=InnoDB;',
      postgres: `CREATE TABLE IF NOT EXISTS "myTable" ("myColumn" DATE); COMMENT ON COLUMN "myTable"."myColumn" IS 'Foo PRIMARY KEY';`,
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([myColumn] DATE);
        EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Foo PRIMARY KEY', @level0type = N'Schema', @level0name = 'dbo',
        @level1type = N'Table', @level1name = [myTable], @level2type = N'Column', @level2name = [myColumn];`,
      sqlite: 'CREATE TABLE IF NOT EXISTS `myTable` (`myColumn` DATE COMMENT Foo PRIMARY KEY);',
      db2: `CREATE TABLE IF NOT EXISTS "myTable" ("myColumn" DATE); -- 'Foo PRIMARY KEY', TableName = "myTable", ColumnName = "myColumn";`,
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("myColumn" DATE COMMENT Foo, PRIMARY KEY ("myColumn")); END`,
    });
  });

  it('produces a query to create a table with both a table comment and a column comment', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { myColumn: 'DATE COMMENT Foo' }, { comment: 'Bar' }), {
      default: `CREATE TABLE IF NOT EXISTS [myTable] ([myColumn] DATE COMMENT Foo) COMMENT 'Bar';`,
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`myColumn` DATE COMMENT Foo) ENGINE=InnoDB COMMENT \'Bar\';',
      postgres: `CREATE TABLE IF NOT EXISTS "myTable" ("myColumn" DATE); COMMENT ON TABLE "myTable" IS 'Bar'; COMMENT ON COLUMN "myTable"."myColumn" IS 'Foo';`,
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([myColumn] DATE);
        EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Foo', @level0type = N'Schema', @level0name = 'dbo',
        @level1type = N'Table', @level1name = [myTable], @level2type = N'Column', @level2name = [myColumn];`,
      sqlite: 'CREATE TABLE IF NOT EXISTS `myTable` (`myColumn` DATE COMMENT Foo);',
      db2: `CREATE TABLE IF NOT EXISTS "myTable" ("myColumn" DATE); -- 'Foo', TableName = "myTable", ColumnName = "myColumn";`,
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("myColumn" DATE COMMENT Foo); END`,
    });
  });

  // quoting the enum values is done by attributesToSQL
  it('produces a query to create a table with an enum', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { myColumn: 'ENUM("foo", "bar")' }), {
      default: 'CREATE TABLE IF NOT EXISTS [myTable] ([myColumn] ENUM("foo", "bar"));',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`myColumn` ENUM("foo", "bar")) ENGINE=InnoDB;',
      postgres: 'CREATE TABLE IF NOT EXISTS "myTable" ("myColumn" "public"."enum_myTable_myColumn");',
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([myColumn] ENUM("foo", "bar"));`,
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("myColumn" ENUM("foo", "bar")); END`,
    });
  });

  it('produces a query to create a table with various integer types', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { myColumn: 'INTEGER', secondColumn: 'BIGINT', thirdColumn: 'SMALLINT' }), {
      default: 'CREATE TABLE IF NOT EXISTS [myTable] ([myColumn] INTEGER, [secondColumn] BIGINT, [thirdColumn] SMALLINT);',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`myColumn` INTEGER, `secondColumn` BIGINT, `thirdColumn` SMALLINT) ENGINE=InnoDB;',
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([myColumn] INTEGER, [secondColumn] BIGINT, [thirdColumn] SMALLINT);`,
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("myColumn" INTEGER, "secondColumn" BIGINT, "thirdColumn" SMALLINT); END`,
    });
  });

  it('produces a query to create a table with various integer serial types', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { myColumn: 'INTEGER SERIAL', secondColumn: 'BIGINT SERIAL', thirdColumn: 'SMALLINT SERIAL' }), {
      default: 'CREATE TABLE IF NOT EXISTS [myTable] ([myColumn] INTEGER SERIAL, [secondColumn] BIGINT SERIAL, [thirdColumn] SMALLINT SERIAL);',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`myColumn` INTEGER SERIAL, `secondColumn` BIGINT SERIAL, `thirdColumn` SMALLINT SERIAL) ENGINE=InnoDB;',
      postgres: 'CREATE TABLE IF NOT EXISTS "myTable" ("myColumn" SERIAL, "secondColumn" BIGSERIAL, "thirdColumn" SMALLSERIAL);',
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([myColumn] INTEGER SERIAL, [secondColumn] BIGINT SERIAL, [thirdColumn] SMALLINT SERIAL);`,
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("myColumn" INTEGER SERIAL, "secondColumn" BIGINT SERIAL, "thirdColumn" SMALLINT SERIAL); END`,
    });
  });

  it('produces a query to create a table with a non-null integer serial', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { myColumn: 'INTEGER SERIAL NOT NULL' }), {
      default: 'CREATE TABLE IF NOT EXISTS [myTable] ([myColumn] INTEGER SERIAL NOT NULL);',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`myColumn` INTEGER SERIAL NOT NULL) ENGINE=InnoDB;',
      postgres: 'CREATE TABLE IF NOT EXISTS "myTable" ("myColumn" SERIAL);',
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([myColumn] INTEGER SERIAL NOT NULL);`,
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("myColumn" INTEGER SERIAL NOT NULL); END`,
    });
  });

  it('produces a query to create a table with an autoincremented integer', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { myColumn: 'INTEGER AUTOINCREMENT' }), {
      default: 'CREATE TABLE IF NOT EXISTS [myTable] ([myColumn] INTEGER AUTOINCREMENT);',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`myColumn` INTEGER AUTOINCREMENT) ENGINE=InnoDB;',
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([myColumn] INTEGER AUTOINCREMENT);`,
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("myColumn" INTEGER AUTOINCREMENT); END`,
    });
  });

  it('produces a query to create a table with a primary key integer', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { myColumn: 'INTEGER PRIMARY KEY' }), {
      default: 'CREATE TABLE IF NOT EXISTS [myTable] ([myColumn] INTEGER, PRIMARY KEY ([myColumn]));',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`myColumn` INTEGER, PRIMARY KEY (`myColumn`)) ENGINE=InnoDB;',
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([myColumn] INTEGER, PRIMARY KEY ([myColumn]));`,
      sqlite: 'CREATE TABLE IF NOT EXISTS `myTable` (`myColumn` INTEGER PRIMARY KEY);',
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("myColumn" INTEGER, PRIMARY KEY ("myColumn")); END`,
    });
  });

  it('produces a query to create a table with an integer and multiple primary keys', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { myColumn: 'INTEGER PRIMARY KEY', secondColumn: 'TEXT PRIMARY KEY' }), {
      default: 'CREATE TABLE IF NOT EXISTS [myTable] ([myColumn] INTEGER, [secondColumn] TEXT, PRIMARY KEY ([myColumn], [secondColumn]));',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`myColumn` INTEGER, `secondColumn` TEXT, PRIMARY KEY (`myColumn`, `secondColumn`)) ENGINE=InnoDB;',
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([myColumn] INTEGER, [secondColumn] TEXT, PRIMARY KEY ([myColumn], [secondColumn]));`,
      sqlite: 'CREATE TABLE IF NOT EXISTS `myTable` (`myColumn` INTEGER NOT NULL, `secondColumn` TEXT NOT NULL, PRIMARY KEY (`myColumn`, `secondColumn`));',
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("myColumn" INTEGER, "secondColumn" TEXT, PRIMARY KEY ("myColumn", "secondColumn")); END`,
    });
  });

  it('produces a query to create a table with non-null integers and multiple primary keys', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { myColumn: 'INTEGER NOT NULL', secondColumn: 'INTEGER PRIMARY KEY NOT NULL', thirdColumn: 'TEXT PRIMARY KEY' }), {
      default: 'CREATE TABLE IF NOT EXISTS [myTable] ([myColumn] INTEGER NOT NULL, [secondColumn] INTEGER NOT NULL, [thirdColumn] TEXT, PRIMARY KEY ([secondColumn], [thirdColumn]));',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`myColumn` INTEGER NOT NULL, `secondColumn` INTEGER NOT NULL, `thirdColumn` TEXT, PRIMARY KEY (`secondColumn`, `thirdColumn`)) ENGINE=InnoDB;',
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([myColumn] INTEGER NOT NULL, [secondColumn] INTEGER NOT NULL, [thirdColumn] TEXT, PRIMARY KEY ([secondColumn], [thirdColumn]));`,
      sqlite: 'CREATE TABLE IF NOT EXISTS `myTable` (`myColumn` INTEGER NOT NULL, `secondColumn` INTEGER NOT NULL, `thirdColumn` TEXT NOT NULL, PRIMARY KEY (`secondColumn`, `thirdColumn`));',
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("myColumn" INTEGER NOT NULL, "secondColumn" INTEGER NOT NULL, "thirdColumn" TEXT, PRIMARY KEY ("secondColumn", "thirdColumn")); END`,
    });
  });

  it('produces a query to create a table with an autoincremented primary key integer', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { myColumn: 'INTEGER AUTOINCREMENT PRIMARY KEY' }), {
      default: 'CREATE TABLE IF NOT EXISTS [myTable] ([myColumn] INTEGER AUTOINCREMENT, PRIMARY KEY ([myColumn]));',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`myColumn` INTEGER AUTOINCREMENT, PRIMARY KEY (`myColumn`)) ENGINE=InnoDB;',
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([myColumn] INTEGER AUTOINCREMENT, PRIMARY KEY ([myColumn]));`,
      sqlite: 'CREATE TABLE IF NOT EXISTS `myTable` (`myColumn` INTEGER PRIMARY KEY AUTOINCREMENT);',
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("myColumn" INTEGER AUTOINCREMENT, PRIMARY KEY ("myColumn")); END`,
    });
  });

  it('produces a query to create a table with primary key integer with specified length and unsigned', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { myColumn: 'INTEGER(5) UNSIGNED PRIMARY KEY' }), {
      default: 'CREATE TABLE IF NOT EXISTS [myTable] ([myColumn] INTEGER(5) UNSIGNED, PRIMARY KEY ([myColumn]));',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`myColumn` INTEGER(5) UNSIGNED, PRIMARY KEY (`myColumn`)) ENGINE=InnoDB;',
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([myColumn] INTEGER(5) UNSIGNED, PRIMARY KEY ([myColumn]));`,
      sqlite: 'CREATE TABLE IF NOT EXISTS `myTable` (`myColumn` INTEGER PRIMARY KEY);',
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("myColumn" INTEGER(5) UNSIGNED, PRIMARY KEY ("myColumn")); END`,
    });
  });

  it('produces a query to create a table with integer with specified length and unsigned', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { myColumn: 'INTEGER(5) UNSIGNED' }), {
      default: 'CREATE TABLE IF NOT EXISTS [myTable] ([myColumn] INTEGER(5) UNSIGNED);',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`myColumn` INTEGER(5) UNSIGNED) ENGINE=InnoDB;',
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([myColumn] INTEGER(5) UNSIGNED);`,
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("myColumn" INTEGER(5) UNSIGNED); END`,
    });
  });

  it('produces a query to create a table with integer with references', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { myColumn: 'INTEGER REFERENCES "Bar" ("id")' }), {
      default: 'CREATE TABLE IF NOT EXISTS [myTable] ([myColumn] INTEGER REFERENCES "Bar" ("id"));',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`myColumn` INTEGER, FOREIGN KEY (`myColumn`) REFERENCES "Bar" ("id")) ENGINE=InnoDB;',
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([myColumn] INTEGER, FOREIGN KEY ([myColumn]) REFERENCES "Bar" ("id"));`,
      'snowflake db2': 'CREATE TABLE IF NOT EXISTS "myTable" ("myColumn" INTEGER, FOREIGN KEY ("myColumn") REFERENCES "Bar" ("id"));',
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("myColumn" INTEGER REFERENCES "Bar" ("id")); END`,
    });
  });

  it('supports the engine option', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { myColumn: 'DATE' }, { engine: 'MyISAM' }), {
      default: 'CREATE TABLE IF NOT EXISTS [myTable] ([myColumn] DATE);',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`myColumn` DATE) ENGINE=MyISAM;',
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([myColumn] DATE);`,
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("myColumn" DATE); END`,
    });
  });

  it('supports the charset option', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { myColumn: 'DATE' }, { charset: 'utf8mb4' }), {
      default: 'CREATE TABLE IF NOT EXISTS [myTable] ([myColumn] DATE);',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`myColumn` DATE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;',
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([myColumn] DATE);`,
      snowflake: 'CREATE TABLE IF NOT EXISTS "myTable" ("myColumn" DATE) DEFAULT CHARSET=utf8mb4;',
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("myColumn" DATE); END`,
    });
  });

  it('supports the collate option', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { myColumn: 'DATE' }, { collate: 'en_US.UTF-8' }), {
      default: 'CREATE TABLE IF NOT EXISTS [myTable] ([myColumn] DATE);',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`myColumn` DATE) ENGINE=InnoDB COLLATE en_US.UTF-8;',
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([myColumn] DATE);`,
      snowflake: 'CREATE TABLE IF NOT EXISTS "myTable" ("myColumn" DATE) COLLATE en_US.UTF-8;',
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("myColumn" DATE); END`,
    });
  });

  it('supports the rowFormat option', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { myColumn: 'DATE' }, { rowFormat: 'default' }), {
      default: 'CREATE TABLE IF NOT EXISTS [myTable] ([myColumn] DATE);',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`myColumn` DATE) ENGINE=InnoDB ROW_FORMAT=default;',
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([myColumn] DATE);`,
      snowflake: 'CREATE TABLE IF NOT EXISTS "myTable" ("myColumn" DATE) ROW_FORMAT=default;',
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("myColumn" DATE); END`,
    });
  });

  it('supports the comment option', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { myColumn: 'DATE' }, { comment: 'Foo' }), {
      default: 'CREATE TABLE IF NOT EXISTS [myTable] ([myColumn] DATE);',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`myColumn` DATE) ENGINE=InnoDB COMMENT \'Foo\';',
      postgres: `CREATE TABLE IF NOT EXISTS "myTable" ("myColumn" DATE); COMMENT ON TABLE "myTable" IS 'Foo';`,
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([myColumn] DATE);`,
      snowflake: `CREATE TABLE IF NOT EXISTS "myTable" ("myColumn" DATE) COMMENT 'Foo';`,
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("myColumn" DATE); END`,
    });
  });

  it('supports the initialAutoIncrement option', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { myColumn: 'DATE' }, { initialAutoIncrement: 1_000_001 }), {
      default: 'CREATE TABLE IF NOT EXISTS [myTable] ([myColumn] DATE);',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`myColumn` DATE) ENGINE=InnoDB AUTO_INCREMENT=1000001;',
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([myColumn] DATE);`,
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("myColumn" DATE); END`,
    });
  });

  describe('supports the uniqueKeys option', () => {
    // TODO: Add (additional) test cases for options.uniqueKeys here

    // --------------------------------------------------

    // SQLITE does not respect the index name when the index is created through CREATE TABLE
    // As such, Sequelize's createTable does not add the constraint in the Sequelize Dialect.
    // Instead, `sequelize.sync` calls CREATE INDEX after the table has been created,
    // as that query *does* respect the index name.

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

    it('produces a CREATE TABLE query with two VARCHAR attributes and a auto-incremented primary key INTEGER with specified unique contraints', () => {
      expectsql(queryGenerator.createTableQuery('myTable', { id: 'INTEGER PRIMARY KEY AUTOINCREMENT', name: 'VARCHAR(255)', surname: 'VARCHAR(255)' }, { uniqueKeys: { uniqueConstraint: { fields: ['name', 'surname'] } } }), {
        'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`id` INTEGER AUTOINCREMENT, `name` VARCHAR(255), `surname` VARCHAR(255), UNIQUE `uniqueConstraint` (`name`, `surname`), PRIMARY KEY (`id`)) ENGINE=InnoDB;',
        postgres: 'CREATE TABLE IF NOT EXISTS "myTable" ("id" INTEGER AUTOINCREMENT, "name" VARCHAR(255), "surname" VARCHAR(255), CONSTRAINT "uniqueConstraint" UNIQUE ("name", "surname"), PRIMARY KEY ("id"));',
        mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([id] INTEGER AUTOINCREMENT, [name] VARCHAR(255), [surname] VARCHAR(255), CONSTRAINT [uniqueConstraint] UNIQUE ([name], [surname]), PRIMARY KEY ([id]));`,
        sqlite: 'CREATE TABLE IF NOT EXISTS `myTable` (`id` INTEGER PRIMARY KEY AUTOINCREMENT, `name` VARCHAR(255), `surname` VARCHAR(255));',
        snowflake: 'CREATE TABLE IF NOT EXISTS "myTable" ("id" INTEGER AUTOINCREMENT, "name" VARCHAR(255), "surname" VARCHAR(255), UNIQUE "uniqueConstraint" ("name", "surname"), PRIMARY KEY ("id"));',
        db2: 'CREATE TABLE IF NOT EXISTS "myTable" ("id" INTEGER AUTOINCREMENT, "name" VARCHAR(255) NOT NULL, "surname" VARCHAR(255) NOT NULL, CONSTRAINT "uniqueConstraint" UNIQUE ("name", "surname"), PRIMARY KEY ("id"));',
        ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("id" INTEGER AUTOINCREMENT, "name" VARCHAR(255), "surname" VARCHAR(255),
          CONSTRAINT "uniqueConstraint" UNIQUE ("name", "surname"), PRIMARY KEY ("id")); END`,
      });
    });
  });
});
