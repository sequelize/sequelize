import { buildInvalidOptionReceivedError } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/check.js';
import { createSequelizeInstance, expectsql, getTestDialect, sequelize } from '../../support';

const dialect = sequelize.dialect;
const dialectName = getTestDialect();

// TODO: check the tests with COMMENT after attributeToSQL quotes the comment
// TODO: double check if all column SQL types are possible results of attributeToSQL after #15533 has been merged
// TODO: see if some logic in handling columns can be moved to attributeToSQL which could make some tests here redundant

describe('QueryGenerator#createTableQuery', () => {
  const queryGenerator = sequelize.queryGenerator;

  it('produces a query to create a table', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { myColumn: 'DATE' }), {
      default: 'CREATE TABLE IF NOT EXISTS [myTable] ([myColumn] DATE);',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`myColumn` DATE) ENGINE=InnoDB;',
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([myColumn] DATE);`,
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("myColumn" DATE); END`,
    });
  });

  it('produces a query to create a table from a model', () => {
    const MyModel = sequelize.define('MyModel', {});

    expectsql(queryGenerator.createTableQuery(MyModel, { myColumn: 'DATE' }), {
      default: 'CREATE TABLE IF NOT EXISTS [MyModels] ([myColumn] DATE);',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `MyModels` (`myColumn` DATE) ENGINE=InnoDB;',
      mssql: `IF OBJECT_ID(N'[MyModels]', 'U') IS NULL CREATE TABLE [MyModels] ([myColumn] DATE);`,
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "MyModels" ("myColumn" DATE); END`,
    });
  });

  it('produces a query to create a table from a model definition', () => {
    const MyModel = sequelize.define('MyModel', {});
    const myDefinition = MyModel.modelDefinition;

    expectsql(queryGenerator.createTableQuery(myDefinition, { myColumn: 'DATE' }), {
      default: 'CREATE TABLE IF NOT EXISTS [MyModels] ([myColumn] DATE);',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `MyModels` (`myColumn` DATE) ENGINE=InnoDB;',
      mssql: `IF OBJECT_ID(N'[MyModels]', 'U') IS NULL CREATE TABLE [MyModels] ([myColumn] DATE);`,
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "MyModels" ("myColumn" DATE); END`,
    });
  });

  it('produces a query to create a table with schema in tableName object', () => {
    expectsql(
      queryGenerator.createTableQuery(
        { tableName: 'myTable', schema: 'mySchema' },
        { myColumn: 'DATE' },
      ),
      {
        default: 'CREATE TABLE IF NOT EXISTS [mySchema].[myTable] ([myColumn] DATE);',
        'mariadb mysql':
          'CREATE TABLE IF NOT EXISTS `mySchema`.`myTable` (`myColumn` DATE) ENGINE=InnoDB;',
        mssql: `IF OBJECT_ID(N'[mySchema].[myTable]', 'U') IS NULL CREATE TABLE [mySchema].[myTable] ([myColumn] DATE);`,
        sqlite3: 'CREATE TABLE IF NOT EXISTS `mySchema.myTable` (`myColumn` DATE);',
        ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "mySchema"."myTable" ("myColumn" DATE); END`,
      },
    );
  });

  it('produces a query to create a table with default schema in tableName object', () => {
    expectsql(
      queryGenerator.createTableQuery(
        { tableName: 'myTable', schema: dialect.getDefaultSchema() },
        { myColumn: 'DATE' },
      ),
      {
        default: 'CREATE TABLE IF NOT EXISTS [myTable] ([myColumn] DATE);',
        'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`myColumn` DATE) ENGINE=InnoDB;',
        mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([myColumn] DATE);`,
        ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("myColumn" DATE); END`,
      },
    );
  });

  it('produces a query to create a table from a table and globally set schema', () => {
    const sequelizeSchema = createSequelizeInstance({ schema: 'mySchema' });
    const queryGeneratorSchema = sequelizeSchema.queryGenerator;

    expectsql(queryGeneratorSchema.createTableQuery('myTable', { myColumn: 'DATE' }), {
      default: 'CREATE TABLE IF NOT EXISTS [mySchema].[myTable] ([myColumn] DATE);',
      'mariadb mysql':
        'CREATE TABLE IF NOT EXISTS `mySchema`.`myTable` (`myColumn` DATE) ENGINE=InnoDB;',
      mssql: `IF OBJECT_ID(N'[mySchema].[myTable]', 'U') IS NULL CREATE TABLE [mySchema].[myTable] ([myColumn] DATE);`,
      sqlite3: 'CREATE TABLE IF NOT EXISTS `mySchema.myTable` (`myColumn` DATE);',
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "mySchema"."myTable" ("myColumn" DATE); END`,
    });
  });

  it('produces a query to create a table with schema and delimiter in tableName object', () => {
    // This test is only relevant for dialects that do not support schemas
    if (dialect.supports.schemas) {
      return;
    }

    expectsql(
      queryGenerator.createTableQuery(
        { tableName: 'myTable', schema: 'mySchema', delimiter: 'custom' },
        { myColumn: 'DATE' },
      ),
      {
        sqlite3: 'CREATE TABLE IF NOT EXISTS `mySchemacustommyTable` (`myColumn` DATE);',
      },
    );
  });

  it('produces a query to create a table with multiple columns', () => {
    expectsql(
      queryGenerator.createTableQuery('myTable', { myColumn: 'DATE', secondColumn: 'TEXT' }),
      {
        default: 'CREATE TABLE IF NOT EXISTS [myTable] ([myColumn] DATE, [secondColumn] TEXT);',
        'mariadb mysql':
          'CREATE TABLE IF NOT EXISTS `myTable` (`myColumn` DATE, `secondColumn` TEXT) ENGINE=InnoDB;',
        mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([myColumn] DATE, [secondColumn] TEXT);`,
        ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("myColumn" DATE, "secondColumn" TEXT); END`,
      },
    );
  });

  it('produces a query to create a table with a primary key', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { myColumn: 'DATE PRIMARY KEY' }), {
      default: 'CREATE TABLE IF NOT EXISTS [myTable] ([myColumn] DATE, PRIMARY KEY ([myColumn]));',
      'mariadb mysql':
        'CREATE TABLE IF NOT EXISTS `myTable` (`myColumn` DATE, PRIMARY KEY (`myColumn`)) ENGINE=InnoDB;',
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([myColumn] DATE, PRIMARY KEY ([myColumn]));`,
      sqlite3: 'CREATE TABLE IF NOT EXISTS `myTable` (`myColumn` DATE PRIMARY KEY);',
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("myColumn" DATE, PRIMARY KEY ("myColumn")); END`,
    });
  });

  it('produces a query to create a table with multiple primary keys', () => {
    expectsql(
      queryGenerator.createTableQuery('myTable', {
        myColumn: 'DATE PRIMARY KEY',
        secondColumn: 'TEXT PRIMARY KEY',
      }),
      {
        default:
          'CREATE TABLE IF NOT EXISTS [myTable] ([myColumn] DATE, [secondColumn] TEXT, PRIMARY KEY ([myColumn], [secondColumn]));',
        'mariadb mysql':
          'CREATE TABLE IF NOT EXISTS `myTable` (`myColumn` DATE, `secondColumn` TEXT, PRIMARY KEY (`myColumn`, `secondColumn`)) ENGINE=InnoDB;',
        mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([myColumn] DATE, [secondColumn] TEXT, PRIMARY KEY ([myColumn], [secondColumn]));`,
        sqlite3:
          'CREATE TABLE IF NOT EXISTS `myTable` (`myColumn` DATE NOT NULL, `secondColumn` TEXT NOT NULL, PRIMARY KEY (`myColumn`, `secondColumn`));',
        ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("myColumn" DATE, "secondColumn" TEXT, PRIMARY KEY ("myColumn", "secondColumn")); END`,
      },
    );
  });

  // quoting the identifiers after REFERENCES is done by attributesToSQL
  it('produces a query to create a table with references', () => {
    expectsql(
      queryGenerator.createTableQuery('myTable', { myColumn: 'DATE REFERENCES "Bar" ("id")' }),
      {
        default: 'CREATE TABLE IF NOT EXISTS [myTable] ([myColumn] DATE REFERENCES "Bar" ("id"));',
        'mariadb mysql':
          'CREATE TABLE IF NOT EXISTS `myTable` (`myColumn` DATE, FOREIGN KEY (`myColumn`) REFERENCES "Bar" ("id")) ENGINE=InnoDB;',
        mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([myColumn] DATE, FOREIGN KEY ([myColumn]) REFERENCES "Bar" ("id"));`,
        'snowflake db2':
          'CREATE TABLE IF NOT EXISTS "myTable" ("myColumn" DATE, FOREIGN KEY ("myColumn") REFERENCES "Bar" ("id"));',
        ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("myColumn" DATE REFERENCES "Bar" ("id")); END`,
      },
    );
  });

  it('produces a query to create a table with references and a primary key', () => {
    expectsql(
      queryGenerator.createTableQuery('myTable', {
        myColumn: 'DATE PRIMARY KEY REFERENCES "Bar" ("id")',
      }),
      {
        default:
          'CREATE TABLE IF NOT EXISTS [myTable] ([myColumn] DATE REFERENCES "Bar" ("id"), PRIMARY KEY ("myColumn"));',
        'mariadb mysql':
          'CREATE TABLE IF NOT EXISTS `myTable` (`myColumn` DATE, PRIMARY KEY (`myColumn`), FOREIGN KEY (`myColumn`) REFERENCES "Bar" ("id")) ENGINE=InnoDB;',
        mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([myColumn] DATE, PRIMARY KEY ([myColumn]), FOREIGN KEY ([myColumn]) REFERENCES "Bar" ("id"));`,
        sqlite3:
          'CREATE TABLE IF NOT EXISTS `myTable` (`myColumn` DATE PRIMARY KEY REFERENCES "Bar" ("id"));',
        'snowflake db2':
          'CREATE TABLE IF NOT EXISTS "myTable" ("myColumn" DATE, PRIMARY KEY ("myColumn"), FOREIGN KEY ("myColumn") REFERENCES "Bar" ("id"));',
        ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("myColumn" DATE REFERENCES "Bar" ("id"), PRIMARY KEY ("myColumn")); END`,
      },
    );
  });

  // TODO: REFERENCES should be pushed to the end, this is likely a bug in mysql/mariadb
  //       mssql and db2 use the same logic but there does not seem to be a valid attributeToSQL result that causes issues
  it('produces a query to create a table with references and a comment', () => {
    expectsql(
      queryGenerator.createTableQuery('myTable', {
        myColumn: 'DATE REFERENCES "Bar" ("id") COMMENT Foo',
      }),
      {
        default:
          'CREATE TABLE IF NOT EXISTS [myTable] ([myColumn] DATE REFERENCES "Bar" ("id") COMMENT Foo);',
        'mariadb mysql':
          'CREATE TABLE IF NOT EXISTS `myTable` (`myColumn` DATE, FOREIGN KEY (`myColumn`) REFERENCES "Bar" ("id") COMMENT Foo) ENGINE=InnoDB;',
        postgres: `CREATE TABLE IF NOT EXISTS "myTable" ("myColumn" DATE REFERENCES "Bar" ("id")); COMMENT ON COLUMN "myTable"."myColumn" IS 'Foo';`,
        mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([myColumn] DATE, FOREIGN KEY ([myColumn]) REFERENCES "Bar" ("id"));
        EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Foo', @level0type = N'Schema', @level0name = N'dbo',
        @level1type = N'Table', @level1name = [myTable], @level2type = N'Column', @level2name = [myColumn];`,
        snowflake:
          'CREATE TABLE IF NOT EXISTS "myTable" ("myColumn" DATE, FOREIGN KEY ("myColumn") REFERENCES "Bar" ("id") COMMENT Foo);',
        db2: `CREATE TABLE IF NOT EXISTS "myTable" ("myColumn" DATE, FOREIGN KEY ("myColumn") REFERENCES "Bar" ("id")); -- 'Foo', TableName = "myTable", ColumnName = "myColumn";`,
        ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("myColumn" DATE REFERENCES "Bar" ("id") COMMENT Foo); END`,
      },
    );
  });

  it('produces a query to create a table with a non-null column', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { myColumn: 'DATE NOT NULL' }), {
      default: 'CREATE TABLE IF NOT EXISTS [myTable] ([myColumn] DATE NOT NULL);',
      'mariadb mysql':
        'CREATE TABLE IF NOT EXISTS `myTable` (`myColumn` DATE NOT NULL) ENGINE=InnoDB;',
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([myColumn] DATE NOT NULL);`,
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("myColumn" DATE NOT NULL); END`,
    });
  });

  it('produces a query to create a table with schema in tableName object and a comment', () => {
    expectsql(
      queryGenerator.createTableQuery(
        { tableName: 'myTable', schema: 'mySchema' },
        { myColumn: 'DATE COMMENT Foo' },
      ),
      {
        default: 'CREATE TABLE IF NOT EXISTS [mySchema].[myTable] ([myColumn] DATE COMMENT Foo);',
        'mariadb mysql':
          'CREATE TABLE IF NOT EXISTS `mySchema`.`myTable` (`myColumn` DATE COMMENT Foo) ENGINE=InnoDB;',
        postgres: `CREATE TABLE IF NOT EXISTS "mySchema"."myTable" ("myColumn" DATE); COMMENT ON COLUMN "mySchema"."myTable"."myColumn" IS 'Foo';`,
        mssql: `IF OBJECT_ID(N'[mySchema].[myTable]', 'U') IS NULL CREATE TABLE [mySchema].[myTable] ([myColumn] DATE);
        EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Foo', @level0type = N'Schema', @level0name = N'mySchema',
        @level1type = N'Table', @level1name = [myTable], @level2type = N'Column', @level2name = [myColumn];`,
        sqlite3: 'CREATE TABLE IF NOT EXISTS `mySchema.myTable` (`myColumn` DATE COMMENT Foo);',
        db2: `CREATE TABLE IF NOT EXISTS "mySchema"."myTable" ("myColumn" DATE); -- 'Foo', TableName = "mySchema"."myTable", ColumnName = "myColumn";`,
        ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "mySchema"."myTable" ("myColumn" DATE COMMENT Foo); END`,
      },
    );
  });

  it('produces a query to create a table with multiple columns with comments', () => {
    expectsql(
      queryGenerator.createTableQuery('myTable', {
        myColumn: 'DATE COMMENT Foo',
        secondColumn: 'DATE COMMENT Foo Bar',
      }),
      {
        default:
          'CREATE TABLE IF NOT EXISTS [myTable] ([myColumn] DATE COMMENT Foo, [secondColumn] DATE COMMENT Foo Bar);',
        'mariadb mysql':
          'CREATE TABLE IF NOT EXISTS `myTable` (`myColumn` DATE COMMENT Foo, `secondColumn` DATE COMMENT Foo Bar) ENGINE=InnoDB;',
        postgres: `CREATE TABLE IF NOT EXISTS "myTable" ("myColumn" DATE, "secondColumn" DATE); COMMENT ON COLUMN "myTable"."myColumn" IS 'Foo'; COMMENT ON COLUMN "myTable"."secondColumn" IS 'Foo Bar';`,
        mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([myColumn] DATE, [secondColumn] DATE);
        EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Foo', @level0type = N'Schema', @level0name = N'dbo',
        @level1type = N'Table', @level1name = [myTable], @level2type = N'Column', @level2name = [myColumn];
        EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Foo Bar', @level0type = N'Schema', @level0name = N'dbo',
        @level1type = N'Table', @level1name = [myTable], @level2type = N'Column', @level2name = [secondColumn];`,
        db2: `CREATE TABLE IF NOT EXISTS "myTable" ("myColumn" DATE, "secondColumn" DATE); -- 'Foo', TableName = "myTable", ColumnName = "myColumn"; -- 'Foo Bar', TableName = "myTable", ColumnName = "secondColumn";`,
        ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("myColumn" DATE COMMENT Foo, "secondColumn" DATE COMMENT Foo Bar); END`,
      },
    );
  });

  // TODO: the second COMMENT should likely be replaced by an empty string in DB2 and MSSQL
  it('produces a query to create a table with multiple comments in one column', () => {
    expectsql(
      queryGenerator.createTableQuery('myTable', { myColumn: 'DATE COMMENT Foo COMMENT Bar' }),
      {
        default: 'CREATE TABLE IF NOT EXISTS [myTable] ([myColumn] DATE COMMENT Foo COMMENT Bar);',
        'mariadb mysql':
          'CREATE TABLE IF NOT EXISTS `myTable` (`myColumn` DATE COMMENT Foo COMMENT Bar) ENGINE=InnoDB;',
        postgres: `CREATE TABLE IF NOT EXISTS "myTable" ("myColumn" DATE); COMMENT ON COLUMN "myTable"."myColumn" IS 'Foo COMMENT Bar';`,
        mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([myColumn] DATE COMMENT Foo);
        EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Bar', @level0type = N'Schema', @level0name = N'dbo',
        @level1type = N'Table', @level1name = [myTable], @level2type = N'Column', @level2name = [myColumn];`,
        db2: `CREATE TABLE IF NOT EXISTS "myTable" ("myColumn" DATE COMMENT Foo); -- 'Bar', TableName = "myTable", ColumnName = "myColumn";`,
        ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("myColumn" DATE COMMENT Foo COMMENT Bar); END`,
      },
    );
  });

  it('produces a query to create a table with a primary key specified after the comment', () => {
    expectsql(
      queryGenerator.createTableQuery('myTable', { myColumn: 'DATE COMMENT Foo PRIMARY KEY' }),
      {
        default:
          'CREATE TABLE IF NOT EXISTS [myTable] ([myColumn] DATE COMMENT Foo, PRIMARY KEY ([myColumn]));',
        'mariadb mysql':
          'CREATE TABLE IF NOT EXISTS `myTable` (`myColumn` DATE COMMENT Foo, PRIMARY KEY (`myColumn`)) ENGINE=InnoDB;',
        postgres: `CREATE TABLE IF NOT EXISTS "myTable" ("myColumn" DATE); COMMENT ON COLUMN "myTable"."myColumn" IS 'Foo PRIMARY KEY';`,
        mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([myColumn] DATE);
        EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Foo PRIMARY KEY', @level0type = N'Schema', @level0name = N'dbo',
        @level1type = N'Table', @level1name = [myTable], @level2type = N'Column', @level2name = [myColumn];`,
        sqlite3: 'CREATE TABLE IF NOT EXISTS `myTable` (`myColumn` DATE COMMENT Foo PRIMARY KEY);',
        db2: `CREATE TABLE IF NOT EXISTS "myTable" ("myColumn" DATE); -- 'Foo PRIMARY KEY', TableName = "myTable", ColumnName = "myColumn";`,
        ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("myColumn" DATE COMMENT Foo, PRIMARY KEY ("myColumn")); END`,
      },
    );
  });

  it('produces a query to create a table with both a table comment and a column comment', () => {
    expectsql(
      () =>
        queryGenerator.createTableQuery(
          'myTable',
          { myColumn: 'DATE COMMENT Foo' },
          { comment: 'Bar' },
        ),
      {
        default: buildInvalidOptionReceivedError('createTableQuery', dialectName, ['comment']),
        'mariadb mysql':
          "CREATE TABLE IF NOT EXISTS `myTable` (`myColumn` DATE COMMENT Foo) ENGINE=InnoDB COMMENT 'Bar';",
        postgres: `CREATE TABLE IF NOT EXISTS "myTable" ("myColumn" DATE); COMMENT ON TABLE "myTable" IS 'Bar'; COMMENT ON COLUMN "myTable"."myColumn" IS 'Foo';`,
        snowflake: `CREATE TABLE IF NOT EXISTS "myTable" ("myColumn" DATE COMMENT Foo) COMMENT 'Bar';`,
      },
    );
  });

  // quoting the enum values is done by attributesToSQL
  it('produces a query to create a table with an enum', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { myColumn: 'ENUM("foo", "bar")' }), {
      default: 'CREATE TABLE IF NOT EXISTS [myTable] ([myColumn] ENUM("foo", "bar"));',
      'mariadb mysql':
        'CREATE TABLE IF NOT EXISTS `myTable` (`myColumn` ENUM("foo", "bar")) ENGINE=InnoDB;',
      postgres:
        'CREATE TABLE IF NOT EXISTS "myTable" ("myColumn" "public"."enum_myTable_myColumn");',
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([myColumn] ENUM("foo", "bar"));`,
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("myColumn" ENUM("foo", "bar")); END`,
    });
  });

  it('produces a query to create a table with various integer types', () => {
    expectsql(
      queryGenerator.createTableQuery('myTable', {
        myColumn: 'INTEGER',
        secondColumn: 'BIGINT',
        thirdColumn: 'SMALLINT',
      }),
      {
        default:
          'CREATE TABLE IF NOT EXISTS [myTable] ([myColumn] INTEGER, [secondColumn] BIGINT, [thirdColumn] SMALLINT);',
        'mariadb mysql':
          'CREATE TABLE IF NOT EXISTS `myTable` (`myColumn` INTEGER, `secondColumn` BIGINT, `thirdColumn` SMALLINT) ENGINE=InnoDB;',
        mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([myColumn] INTEGER, [secondColumn] BIGINT, [thirdColumn] SMALLINT);`,
        ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("myColumn" INTEGER, "secondColumn" BIGINT, "thirdColumn" SMALLINT); END`,
      },
    );
  });

  it('produces a query to create a table with various integer serial types', () => {
    expectsql(
      queryGenerator.createTableQuery('myTable', {
        myColumn: 'INTEGER SERIAL',
        secondColumn: 'BIGINT SERIAL',
        thirdColumn: 'SMALLINT SERIAL',
      }),
      {
        default:
          'CREATE TABLE IF NOT EXISTS [myTable] ([myColumn] INTEGER SERIAL, [secondColumn] BIGINT SERIAL, [thirdColumn] SMALLINT SERIAL);',
        'mariadb mysql':
          'CREATE TABLE IF NOT EXISTS `myTable` (`myColumn` INTEGER SERIAL, `secondColumn` BIGINT SERIAL, `thirdColumn` SMALLINT SERIAL) ENGINE=InnoDB;',
        postgres:
          'CREATE TABLE IF NOT EXISTS "myTable" ("myColumn" SERIAL, "secondColumn" BIGSERIAL, "thirdColumn" SMALLSERIAL);',
        mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([myColumn] INTEGER SERIAL, [secondColumn] BIGINT SERIAL, [thirdColumn] SMALLINT SERIAL);`,
        ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("myColumn" INTEGER SERIAL, "secondColumn" BIGINT SERIAL, "thirdColumn" SMALLINT SERIAL); END`,
      },
    );
  });

  it('produces a query to create a table with a non-null integer serial', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { myColumn: 'INTEGER SERIAL NOT NULL' }), {
      default: 'CREATE TABLE IF NOT EXISTS [myTable] ([myColumn] INTEGER SERIAL NOT NULL);',
      'mariadb mysql':
        'CREATE TABLE IF NOT EXISTS `myTable` (`myColumn` INTEGER SERIAL NOT NULL) ENGINE=InnoDB;',
      postgres: 'CREATE TABLE IF NOT EXISTS "myTable" ("myColumn" SERIAL);',
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([myColumn] INTEGER SERIAL NOT NULL);`,
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("myColumn" INTEGER SERIAL NOT NULL); END`,
    });
  });

  it('produces a query to create a table with an autoincremented integer', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { myColumn: 'INTEGER AUTOINCREMENT' }), {
      default: 'CREATE TABLE IF NOT EXISTS [myTable] ([myColumn] INTEGER AUTOINCREMENT);',
      'mariadb mysql':
        'CREATE TABLE IF NOT EXISTS `myTable` (`myColumn` INTEGER AUTOINCREMENT) ENGINE=InnoDB;',
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([myColumn] INTEGER AUTOINCREMENT);`,
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("myColumn" INTEGER AUTOINCREMENT); END`,
      snowflake:
        'CREATE TABLE IF NOT EXISTS "myTable" ("myColumn" INTEGER DEFAULT "myTable_myColumn_seq".NEXTVAL);',
    });
  });

  it('produces a query to create a table with a primary key integer', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { myColumn: 'INTEGER PRIMARY KEY' }), {
      default:
        'CREATE TABLE IF NOT EXISTS [myTable] ([myColumn] INTEGER, PRIMARY KEY ([myColumn]));',
      'mariadb mysql':
        'CREATE TABLE IF NOT EXISTS `myTable` (`myColumn` INTEGER, PRIMARY KEY (`myColumn`)) ENGINE=InnoDB;',
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([myColumn] INTEGER, PRIMARY KEY ([myColumn]));`,
      sqlite3: 'CREATE TABLE IF NOT EXISTS `myTable` (`myColumn` INTEGER PRIMARY KEY);',
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("myColumn" INTEGER, PRIMARY KEY ("myColumn")); END`,
    });
  });

  it('produces a query to create a table with an integer and multiple primary keys', () => {
    expectsql(
      queryGenerator.createTableQuery('myTable', {
        myColumn: 'INTEGER PRIMARY KEY',
        secondColumn: 'TEXT PRIMARY KEY',
      }),
      {
        default:
          'CREATE TABLE IF NOT EXISTS [myTable] ([myColumn] INTEGER, [secondColumn] TEXT, PRIMARY KEY ([myColumn], [secondColumn]));',
        'mariadb mysql':
          'CREATE TABLE IF NOT EXISTS `myTable` (`myColumn` INTEGER, `secondColumn` TEXT, PRIMARY KEY (`myColumn`, `secondColumn`)) ENGINE=InnoDB;',
        mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([myColumn] INTEGER, [secondColumn] TEXT, PRIMARY KEY ([myColumn], [secondColumn]));`,
        sqlite3:
          'CREATE TABLE IF NOT EXISTS `myTable` (`myColumn` INTEGER NOT NULL, `secondColumn` TEXT NOT NULL, PRIMARY KEY (`myColumn`, `secondColumn`));',
        ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("myColumn" INTEGER, "secondColumn" TEXT, PRIMARY KEY ("myColumn", "secondColumn")); END`,
      },
    );
  });

  it('produces a query to create a table with non-null integers and multiple primary keys', () => {
    expectsql(
      queryGenerator.createTableQuery('myTable', {
        myColumn: 'INTEGER NOT NULL',
        secondColumn: 'INTEGER PRIMARY KEY NOT NULL',
        thirdColumn: 'TEXT PRIMARY KEY',
      }),
      {
        default:
          'CREATE TABLE IF NOT EXISTS [myTable] ([myColumn] INTEGER NOT NULL, [secondColumn] INTEGER NOT NULL, [thirdColumn] TEXT, PRIMARY KEY ([secondColumn], [thirdColumn]));',
        'mariadb mysql':
          'CREATE TABLE IF NOT EXISTS `myTable` (`myColumn` INTEGER NOT NULL, `secondColumn` INTEGER NOT NULL, `thirdColumn` TEXT, PRIMARY KEY (`secondColumn`, `thirdColumn`)) ENGINE=InnoDB;',
        mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([myColumn] INTEGER NOT NULL, [secondColumn] INTEGER NOT NULL, [thirdColumn] TEXT, PRIMARY KEY ([secondColumn], [thirdColumn]));`,
        sqlite3:
          'CREATE TABLE IF NOT EXISTS `myTable` (`myColumn` INTEGER NOT NULL, `secondColumn` INTEGER NOT NULL, `thirdColumn` TEXT NOT NULL, PRIMARY KEY (`secondColumn`, `thirdColumn`));',
        ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("myColumn" INTEGER NOT NULL, "secondColumn" INTEGER NOT NULL, "thirdColumn" TEXT, PRIMARY KEY ("secondColumn", "thirdColumn")); END`,
      },
    );
  });

  it('produces a query to create a table with an autoincremented primary key integer', () => {
    expectsql(
      queryGenerator.createTableQuery('myTable', { myColumn: 'INTEGER AUTOINCREMENT PRIMARY KEY' }),
      {
        default:
          'CREATE TABLE IF NOT EXISTS [myTable] ([myColumn] INTEGER AUTOINCREMENT, PRIMARY KEY ([myColumn]));',
        'mariadb mysql':
          'CREATE TABLE IF NOT EXISTS `myTable` (`myColumn` INTEGER AUTOINCREMENT, PRIMARY KEY (`myColumn`)) ENGINE=InnoDB;',
        mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([myColumn] INTEGER AUTOINCREMENT, PRIMARY KEY ([myColumn]));`,
        sqlite3:
          'CREATE TABLE IF NOT EXISTS `myTable` (`myColumn` INTEGER PRIMARY KEY AUTOINCREMENT);',
        ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("myColumn" INTEGER AUTOINCREMENT, PRIMARY KEY ("myColumn")); END`,
        snowflake:
          'CREATE TABLE IF NOT EXISTS "myTable" ("myColumn" INTEGER DEFAULT "myTable_myColumn_seq".NEXTVAL, PRIMARY KEY ("myColumn"));',
      },
    );
  });

  it('produces a query to create a table with primary key integer with specified length and unsigned', () => {
    expectsql(
      queryGenerator.createTableQuery('myTable', { myColumn: 'INTEGER(5) UNSIGNED PRIMARY KEY' }),
      {
        default:
          'CREATE TABLE IF NOT EXISTS [myTable] ([myColumn] INTEGER(5) UNSIGNED, PRIMARY KEY ([myColumn]));',
        'mariadb mysql':
          'CREATE TABLE IF NOT EXISTS `myTable` (`myColumn` INTEGER(5) UNSIGNED, PRIMARY KEY (`myColumn`)) ENGINE=InnoDB;',
        mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([myColumn] INTEGER(5) UNSIGNED, PRIMARY KEY ([myColumn]));`,
        sqlite3: 'CREATE TABLE IF NOT EXISTS `myTable` (`myColumn` INTEGER PRIMARY KEY);',
        ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("myColumn" INTEGER(5) UNSIGNED, PRIMARY KEY ("myColumn")); END`,
      },
    );
  });

  it('produces a query to create a table with integer with specified length and unsigned', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { myColumn: 'INTEGER(5) UNSIGNED' }), {
      default: 'CREATE TABLE IF NOT EXISTS [myTable] ([myColumn] INTEGER(5) UNSIGNED);',
      'mariadb mysql':
        'CREATE TABLE IF NOT EXISTS `myTable` (`myColumn` INTEGER(5) UNSIGNED) ENGINE=InnoDB;',
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([myColumn] INTEGER(5) UNSIGNED);`,
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("myColumn" INTEGER(5) UNSIGNED); END`,
    });
  });

  it('produces a query to create a table with integer with references', () => {
    expectsql(
      queryGenerator.createTableQuery('myTable', { myColumn: 'INTEGER REFERENCES "Bar" ("id")' }),
      {
        default:
          'CREATE TABLE IF NOT EXISTS [myTable] ([myColumn] INTEGER REFERENCES "Bar" ("id"));',
        'mariadb mysql':
          'CREATE TABLE IF NOT EXISTS `myTable` (`myColumn` INTEGER, FOREIGN KEY (`myColumn`) REFERENCES "Bar" ("id")) ENGINE=InnoDB;',
        mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([myColumn] INTEGER, FOREIGN KEY ([myColumn]) REFERENCES "Bar" ("id"));`,
        'snowflake db2':
          'CREATE TABLE IF NOT EXISTS "myTable" ("myColumn" INTEGER, FOREIGN KEY ("myColumn") REFERENCES "Bar" ("id"));',
        ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("myColumn" INTEGER REFERENCES "Bar" ("id")); END`,
      },
    );
  });

  it('supports the engine option', () => {
    expectsql(
      () => queryGenerator.createTableQuery('myTable', { myColumn: 'DATE' }, { engine: 'MyISAM' }),
      {
        default: buildInvalidOptionReceivedError('createTableQuery', dialectName, ['engine']),
        'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`myColumn` DATE) ENGINE=MyISAM;',
      },
    );
  });

  it('supports the charset option', () => {
    expectsql(
      () =>
        queryGenerator.createTableQuery('myTable', { myColumn: 'DATE' }, { charset: 'utf8mb4' }),
      {
        default: buildInvalidOptionReceivedError('createTableQuery', dialectName, ['charset']),
        'mariadb mysql':
          'CREATE TABLE IF NOT EXISTS `myTable` (`myColumn` DATE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;',
      },
    );
  });

  it('supports the collate option', () => {
    expectsql(
      () =>
        queryGenerator.createTableQuery(
          'myTable',
          { myColumn: 'DATE' },
          { collate: 'en_US.UTF-8' },
        ),
      {
        default: buildInvalidOptionReceivedError('createTableQuery', dialectName, ['collate']),
        'mariadb mysql':
          'CREATE TABLE IF NOT EXISTS `myTable` (`myColumn` DATE) ENGINE=InnoDB COLLATE en_US.UTF-8;',
      },
    );
  });

  it('supports the rowFormat option', () => {
    expectsql(
      () =>
        queryGenerator.createTableQuery('myTable', { myColumn: 'DATE' }, { rowFormat: 'default' }),
      {
        default: buildInvalidOptionReceivedError('createTableQuery', dialectName, ['rowFormat']),
        'mariadb mysql':
          'CREATE TABLE IF NOT EXISTS `myTable` (`myColumn` DATE) ENGINE=InnoDB ROW_FORMAT=default;',
      },
    );
  });

  it('supports the comment option', () => {
    expectsql(
      () => queryGenerator.createTableQuery('myTable', { myColumn: 'DATE' }, { comment: 'Foo' }),
      {
        default: buildInvalidOptionReceivedError('createTableQuery', dialectName, ['comment']),
        'mariadb mysql':
          "CREATE TABLE IF NOT EXISTS `myTable` (`myColumn` DATE) ENGINE=InnoDB COMMENT 'Foo';",
        postgres: `CREATE TABLE IF NOT EXISTS "myTable" ("myColumn" DATE); COMMENT ON TABLE "myTable" IS 'Foo';`,
        snowflake: `CREATE TABLE IF NOT EXISTS "myTable" ("myColumn" DATE) COMMENT 'Foo';`,
      },
    );
  });

  it('supports the initialAutoIncrement option', () => {
    expectsql(
      () =>
        queryGenerator.createTableQuery(
          'myTable',
          { myColumn: 'DATE' },
          { initialAutoIncrement: 1_000_001 },
        ),
      {
        default: buildInvalidOptionReceivedError('createTableQuery', dialectName, [
          'initialAutoIncrement',
        ]),
        'mariadb mysql':
          'CREATE TABLE IF NOT EXISTS `myTable` (`myColumn` DATE) ENGINE=InnoDB AUTO_INCREMENT=1000001;',
      },
    );
  });

  describe('supports the uniqueKeys option', () => {
    // SQLITE does not respect the index name when the index is created through CREATE TABLE
    // As such, Sequelize's createTable does not add the constraint in the Sequelize Dialect.
    // Instead, `sequelize.sync` calls CREATE INDEX after the table has been created,
    // as that query *does* respect the index name.

    it('with an array', () => {
      expectsql(
        () =>
          queryGenerator.createTableQuery(
            'myTable',
            { myColumn: 'DATE', secondColumn: 'TEXT' },
            { uniqueKeys: [{ fields: ['myColumn', 'secondColumn'] }] },
          ),
        {
          default: buildInvalidOptionReceivedError('createTableQuery', dialectName, ['uniqueKeys']),
          'mariadb mysql':
            'CREATE TABLE IF NOT EXISTS `myTable` (`myColumn` DATE, `secondColumn` TEXT, UNIQUE `uniq_myTable_myColumn_secondColumn` (`myColumn`, `secondColumn`)) ENGINE=InnoDB;',
          postgres:
            'CREATE TABLE IF NOT EXISTS "myTable" ("myColumn" DATE, "secondColumn" TEXT, CONSTRAINT "my_table_my_column_second_column" UNIQUE ("myColumn", "secondColumn"));',
          mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([myColumn] DATE, [secondColumn] TEXT, CONSTRAINT [my_table_my_column_second_column] UNIQUE ([myColumn], [secondColumn]));`,
          snowflake:
            'CREATE TABLE IF NOT EXISTS "myTable" ("myColumn" DATE, "secondColumn" TEXT, UNIQUE "uniq_myTable_myColumn_secondColumn" ("myColumn", "secondColumn"));',
          db2: 'CREATE TABLE IF NOT EXISTS "myTable" ("myColumn" DATE NOT NULL, "secondColumn" TEXT NOT NULL, CONSTRAINT "uniq_myTable_myColumn_secondColumn" UNIQUE ("myColumn", "secondColumn"));',
          ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("myColumn" DATE, "secondColumn" TEXT, CONSTRAINT "uniq_myTable_myColumn_secondColumn" UNIQUE ("myColumn", "secondColumn")); END`,
        },
      );
    });

    it('with an indexName', () => {
      expectsql(
        () =>
          queryGenerator.createTableQuery(
            'myTable',
            { myColumn: 'DATE', secondColumn: 'TEXT' },
            { uniqueKeys: { myIndex: { fields: ['myColumn', 'secondColumn'] } } },
          ),
        {
          default: buildInvalidOptionReceivedError('createTableQuery', dialectName, ['uniqueKeys']),
          'mariadb mysql':
            'CREATE TABLE IF NOT EXISTS `myTable` (`myColumn` DATE, `secondColumn` TEXT, UNIQUE `myIndex` (`myColumn`, `secondColumn`)) ENGINE=InnoDB;',
          postgres:
            'CREATE TABLE IF NOT EXISTS "myTable" ("myColumn" DATE, "secondColumn" TEXT, CONSTRAINT "myIndex" UNIQUE ("myColumn", "secondColumn"));',
          mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([myColumn] DATE, [secondColumn] TEXT, CONSTRAINT [myIndex] UNIQUE ([myColumn], [secondColumn]));`,
          snowflake:
            'CREATE TABLE IF NOT EXISTS "myTable" ("myColumn" DATE, "secondColumn" TEXT, UNIQUE "myIndex" ("myColumn", "secondColumn"));',
          db2: 'CREATE TABLE IF NOT EXISTS "myTable" ("myColumn" DATE NOT NULL, "secondColumn" TEXT NOT NULL, CONSTRAINT "myIndex" UNIQUE ("myColumn", "secondColumn"));',
          ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("myColumn" DATE, "secondColumn" TEXT, CONSTRAINT "myIndex" UNIQUE ("myColumn", "secondColumn")); END`,
        },
      );
    });

    it('with a single field', () => {
      expectsql(
        () =>
          queryGenerator.createTableQuery(
            'myTable',
            { myColumn: 'DATE' },
            { uniqueKeys: [{ fields: ['myColumn'] }] },
          ),
        {
          default: buildInvalidOptionReceivedError('createTableQuery', dialectName, ['uniqueKeys']),
          'mariadb mysql':
            'CREATE TABLE IF NOT EXISTS `myTable` (`myColumn` DATE, UNIQUE `uniq_myTable_myColumn` (`myColumn`)) ENGINE=InnoDB;',
          postgres:
            'CREATE TABLE IF NOT EXISTS "myTable" ("myColumn" DATE, CONSTRAINT "my_table_my_column" UNIQUE ("myColumn"));',
          mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([myColumn] DATE, CONSTRAINT [my_table_my_column] UNIQUE ([myColumn]));`,
          snowflake:
            'CREATE TABLE IF NOT EXISTS "myTable" ("myColumn" DATE, UNIQUE "uniq_myTable_myColumn" ("myColumn"));',
          db2: 'CREATE TABLE IF NOT EXISTS "myTable" ("myColumn" DATE NOT NULL, CONSTRAINT "uniq_myTable_myColumn" UNIQUE ("myColumn"));',
          ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("myColumn" DATE, CONSTRAINT "uniq_myTable_myColumn" UNIQUE ("myColumn")); END`,
        },
      );
    });

    it('with primary key fields', () => {
      expectsql(
        () =>
          queryGenerator.createTableQuery(
            'myTable',
            { myColumn: 'DATE PRIMARY KEY', secondColumn: 'TEXT PRIMARY KEY' },
            { uniqueKeys: [{ fields: ['myColumn', 'secondColumn'] }] },
          ),
        {
          default: buildInvalidOptionReceivedError('createTableQuery', dialectName, ['uniqueKeys']),
          'mariadb mysql':
            'CREATE TABLE IF NOT EXISTS `myTable` (`myColumn` DATE, `secondColumn` TEXT, UNIQUE `uniq_myTable_myColumn_secondColumn` (`myColumn`, `secondColumn`), PRIMARY KEY (`myColumn`, `secondColumn`)) ENGINE=InnoDB;',
          postgres:
            'CREATE TABLE IF NOT EXISTS "myTable" ("myColumn" DATE, "secondColumn" TEXT, CONSTRAINT "my_table_my_column_second_column" UNIQUE ("myColumn", "secondColumn"), PRIMARY KEY ("myColumn", "secondColumn"));',
          mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([myColumn] DATE, [secondColumn] TEXT, CONSTRAINT [my_table_my_column_second_column] UNIQUE ([myColumn], [secondColumn]), PRIMARY KEY ([myColumn], [secondColumn]));`,
          snowflake:
            'CREATE TABLE IF NOT EXISTS "myTable" ("myColumn" DATE, "secondColumn" TEXT, UNIQUE "uniq_myTable_myColumn_secondColumn" ("myColumn", "secondColumn"), PRIMARY KEY ("myColumn", "secondColumn"));',
          db2: 'CREATE TABLE IF NOT EXISTS "myTable" ("myColumn" DATE, "secondColumn" TEXT, CONSTRAINT "uniq_myTable_myColumn_secondColumn" UNIQUE ("myColumn", "secondColumn"), PRIMARY KEY ("myColumn", "secondColumn"));',
          ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("myColumn" DATE, "secondColumn" TEXT, PRIMARY KEY ("myColumn", "secondColumn")); END`,
        },
      );
    });

    it('with a non-null column', () => {
      expectsql(
        () =>
          queryGenerator.createTableQuery(
            'myTable',
            { myColumn: 'DATE NOT NULL', secondColumn: 'TEXT' },
            { uniqueKeys: [{ fields: ['myColumn', 'secondColumn'] }] },
          ),
        {
          default: buildInvalidOptionReceivedError('createTableQuery', dialectName, ['uniqueKeys']),
          'mariadb mysql':
            'CREATE TABLE IF NOT EXISTS `myTable` (`myColumn` DATE NOT NULL, `secondColumn` TEXT, UNIQUE `uniq_myTable_myColumn_secondColumn` (`myColumn`, `secondColumn`)) ENGINE=InnoDB;',
          postgres:
            'CREATE TABLE IF NOT EXISTS "myTable" ("myColumn" DATE NOT NULL, "secondColumn" TEXT, CONSTRAINT "my_table_my_column_second_column" UNIQUE ("myColumn", "secondColumn"));',
          mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([myColumn] DATE NOT NULL, [secondColumn] TEXT, CONSTRAINT [my_table_my_column_second_column] UNIQUE ([myColumn], [secondColumn]));`,
          snowflake:
            'CREATE TABLE IF NOT EXISTS "myTable" ("myColumn" DATE NOT NULL, "secondColumn" TEXT, UNIQUE "uniq_myTable_myColumn_secondColumn" ("myColumn", "secondColumn"));',
          db2: 'CREATE TABLE IF NOT EXISTS "myTable" ("myColumn" DATE NOT NULL, "secondColumn" TEXT NOT NULL, CONSTRAINT "uniq_myTable_myColumn_secondColumn" UNIQUE ("myColumn", "secondColumn"));',
          ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("myColumn" DATE NOT NULL, "secondColumn" TEXT, CONSTRAINT "uniq_myTable_myColumn_secondColumn" UNIQUE ("myColumn", "secondColumn")); END`,
        },
      );
    });

    it('with a primary key column with references', () => {
      expectsql(
        () =>
          queryGenerator.createTableQuery(
            'myTable',
            { myColumn: 'DATE PRIMARY KEY REFERENCES "Bar" ("id")', secondColumn: 'TEXT' },
            { uniqueKeys: [{ fields: ['myColumn', 'secondColumn'] }] },
          ),
        {
          default: buildInvalidOptionReceivedError('createTableQuery', dialectName, ['uniqueKeys']),
          'mariadb mysql':
            'CREATE TABLE IF NOT EXISTS `myTable` (`myColumn` DATE, `secondColumn` TEXT, UNIQUE `uniq_myTable_myColumn_secondColumn` (`myColumn`, `secondColumn`), PRIMARY KEY (`myColumn`), FOREIGN KEY (`myColumn`) REFERENCES "Bar" ("id")) ENGINE=InnoDB;',
          postgres:
            'CREATE TABLE IF NOT EXISTS "myTable" ("myColumn" DATE REFERENCES "Bar" ("id"), "secondColumn" TEXT, CONSTRAINT "my_table_my_column_second_column" UNIQUE ("myColumn", "secondColumn"), PRIMARY KEY ("myColumn"));',
          mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([myColumn] DATE, [secondColumn] TEXT, CONSTRAINT [my_table_my_column_second_column] UNIQUE ([myColumn], [secondColumn]), PRIMARY KEY ([myColumn]), FOREIGN KEY ([myColumn]) REFERENCES "Bar" ("id"));`,
          snowflake:
            'CREATE TABLE IF NOT EXISTS "myTable" ("myColumn" DATE, "secondColumn" TEXT, UNIQUE "uniq_myTable_myColumn_secondColumn" ("myColumn", "secondColumn"), PRIMARY KEY ("myColumn"), FOREIGN KEY ("myColumn") REFERENCES "Bar" ("id"));',
          db2: 'CREATE TABLE IF NOT EXISTS "myTable" ("myColumn" DATE, "secondColumn" TEXT NOT NULL, CONSTRAINT "uniq_myTable_myColumn_secondColumn" UNIQUE ("myColumn", "secondColumn"), PRIMARY KEY ("myColumn"), FOREIGN KEY ("myColumn") REFERENCES "Bar" ("id"));',
          ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("myColumn" DATE REFERENCES "Bar" ("id"), "secondColumn" TEXT, CONSTRAINT "uniq_myTable_myColumn_secondColumn" UNIQUE ("myColumn", "secondColumn"), PRIMARY KEY ("myColumn")); END`,
        },
      );
    });
  });
});
