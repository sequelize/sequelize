import { DataTypes } from '@sequelize/core';
import { expectsql, getTestDialect, sequelize } from '../../support';

const dialectName = getTestDialect();

// TODO: improve the names of the tests
describe('QueryGenerator#createTableQuery', () => {
  const queryGenerator = sequelize.getQueryInterface().queryGenerator;

  it('produces a CREATE TABLE query', () => {
    // @ts-expect-error - createTableQuery is not yet typed
    expectsql(() => queryGenerator.createTableQuery('myTable', { int: 'INTEGER' }, {}), {
      // TODO: Throw an error for invalid options
      default: 'CREATE TABLE IF NOT EXISTS [myTable] ([int] INTEGER);',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`int` INTEGER) ENGINE=InnoDB;',
      mssql: `IF OBJECT_ID('[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([int] INTEGER);`,
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("int" INTEGER); END`,
    });
  });

  it('produces a CREATE TABLE query with comments', () => {
    // @ts-expect-error - createTableQuery is not yet typed
    expectsql(() => queryGenerator.createTableQuery('myTable', { int: 'INTEGER COMMENT Foo Bar', varchar: 'VARCHAR(50) UNIQUE COMMENT Bar Foo' }, {}), {
      // TODO: Throw an error for invalid options
      default: 'CREATE TABLE IF NOT EXISTS [myTable] ([int] INTEGER COMMENT Foo Bar, [varchar] VARCHAR(50) UNIQUE COMMENT Bar Foo);',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`int` INTEGER COMMENT Foo Bar, `varchar` VARCHAR(50) UNIQUE COMMENT Bar Foo) ENGINE=InnoDB;',
      postgres: `CREATE TABLE IF NOT EXISTS "myTable" ("int" INTEGER, "varchar" VARCHAR(50) UNIQUE); COMMENT ON COLUMN "myTable"."int" IS 'Foo Bar'; COMMENT ON COLUMN "myTable"."varchar" IS 'Bar Foo';`,
      mssql: 'IF OBJECT_ID(\'[myTable]\', \'U\') IS NULL CREATE TABLE [myTable] ([int] INTEGER, [varchar] VARCHAR(50) UNIQUE); EXEC sp_addextendedproperty @name = N\'MS_Description\', @value = N\'Foo Bar\', @level0type = N\'Schema\', @level0name = \'dbo\', @level1type = N\'Table\', @level1name = [myTable], @level2type = N\'Column\', @level2name = [int]; EXEC sp_addextendedproperty @name = N\'MS_Description\', @value = N\'Bar Foo\', @level0type = N\'Schema\', @level0name = \'dbo\', @level1type = N\'Table\', @level1name = [myTable], @level2type = N\'Column\', @level2name = [varchar];',
      db2: `CREATE TABLE IF NOT EXISTS "myTable" ("int" INTEGER, "varchar" VARCHAR(50) UNIQUE); -- 'Foo Bar', TableName = "myTable", ColumnName = "int"; -- 'Bar Foo', TableName = "myTable", ColumnName = "varchar";`,
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("int" INTEGER COMMENT Foo Bar, "varchar" VARCHAR(50) UNIQUE COMMENT Bar Foo); END`,
    });
  });

  it('produces a CREATE TABLE query with comments and table object', () => {
    // @ts-expect-error - createTableQuery is not yet typed
    expectsql(() => queryGenerator.createTableQuery({ tableName: 'myTable' }, { int: 'INTEGER COMMENT Foo Bar', varchar: 'VARCHAR(50) UNIQUE COMMENT Bar Foo' }, {}), {
      // TODO: Throw an error for invalid options
      default: 'CREATE TABLE IF NOT EXISTS [myTable] ([int] INTEGER COMMENT Foo Bar, [varchar] VARCHAR(50) UNIQUE COMMENT Bar Foo);',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`int` INTEGER COMMENT Foo Bar, `varchar` VARCHAR(50) UNIQUE COMMENT Bar Foo) ENGINE=InnoDB;',
      postgres: `CREATE TABLE IF NOT EXISTS "myTable" ("int" INTEGER, "varchar" VARCHAR(50) UNIQUE); COMMENT ON COLUMN "myTable"."int" IS 'Foo Bar'; COMMENT ON COLUMN "myTable"."varchar" IS 'Bar Foo';`,
      mssql: 'IF OBJECT_ID(\'[myTable]\', \'U\') IS NULL CREATE TABLE [myTable] ([int] INTEGER, [varchar] VARCHAR(50) UNIQUE); EXEC sp_addextendedproperty @name = N\'MS_Description\', @value = N\'Foo Bar\', @level0type = N\'Schema\', @level0name = \'dbo\', @level1type = N\'Table\', @level1name = [myTable], @level2type = N\'Column\', @level2name = [int]; EXEC sp_addextendedproperty @name = N\'MS_Description\', @value = N\'Bar Foo\', @level0type = N\'Schema\', @level0name = \'dbo\', @level1type = N\'Table\', @level1name = [myTable], @level2type = N\'Column\', @level2name = [varchar];',
      db2: new Error('s.replace is not a function'),
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("int" INTEGER COMMENT Foo Bar, "varchar" VARCHAR(50) UNIQUE COMMENT Bar Foo); END`,
    });
  });

  it('produces a CREATE TABLE query', () => {
    // @ts-expect-error - createTableQuery is not yet typed
    expectsql(() => queryGenerator.createTableQuery('myTable', { title: 'VARCHAR(255)', name: 'VARCHAR(255)' }), {
      default: 'CREATE TABLE IF NOT EXISTS [myTable] ([title] VARCHAR(255), [name] VARCHAR(255));',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`title` VARCHAR(255), `name` VARCHAR(255)) ENGINE=InnoDB;',
      // TODO: Throw an error for invalid options
      'mssql ibmi': new Error(`Cannot read properties of undefined (reading 'uniqueKeys')`),
    });
  });

  it('produces a CREATE TABLE query', () => {
    // @ts-expect-error - createTableQuery is not yet typed
    expectsql(() => queryGenerator.createTableQuery({ tableName: 'myTable', schema: 'mySchema' }, { title: 'VARCHAR(255)', name: 'VARCHAR(255)' }), {
      default: 'CREATE TABLE IF NOT EXISTS [mySchema].[myTable] ([title] VARCHAR(255), [name] VARCHAR(255));',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `mySchema`.`myTable` (`title` VARCHAR(255), `name` VARCHAR(255)) ENGINE=InnoDB;',
      // TODO: Throw an error for invalid options
      'mssql ibmi': new Error(`Cannot read properties of undefined (reading 'uniqueKeys')`),
      sqlite: 'CREATE TABLE IF NOT EXISTS `mySchema.myTable` (`title` VARCHAR(255), `name` VARCHAR(255));',
    });
  });

  it('produces a CREATE TABLE query', () => {
    // @ts-expect-error - createTableQuery is not yet typed
    expectsql(() => queryGenerator.createTableQuery('myTable', { data: 'BLOB' }), {
      default: 'CREATE TABLE IF NOT EXISTS [myTable] ([data] BLOB);',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`data` BLOB) ENGINE=InnoDB;',
      // TODO: Throw an error for invalid options
      'mssql ibmi': new Error(`Cannot read properties of undefined (reading 'uniqueKeys')`),
    });
  });

  it('produces a CREATE TABLE query', () => {
    // @ts-expect-error - createTableQuery is not yet typed
    expectsql(() => queryGenerator.createTableQuery('myTable', { data: 'LONGBLOB' }), {
      default: 'CREATE TABLE IF NOT EXISTS [myTable] ([data] LONGBLOB);',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`data` LONGBLOB) ENGINE=InnoDB;',
      // TODO: Throw an error for invalid options
      'mssql ibmi': new Error(`Cannot read properties of undefined (reading 'uniqueKeys')`),
    });
  });

  it('produces a CREATE TABLE query', () => {
    // @ts-expect-error - createTableQuery is not yet typed
    expectsql(() => queryGenerator.createTableQuery('myTable', { data: 'BLOB(16M)' }), {
      default: 'CREATE TABLE IF NOT EXISTS [myTable] ([data] BLOB(16M));',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`data` BLOB(16M)) ENGINE=InnoDB;',
      // TODO: Throw an error for invalid options
      'mssql ibmi': new Error(`Cannot read properties of undefined (reading 'uniqueKeys')`),
    });
  });

  it('produces a CREATE TABLE query', () => {
    // @ts-expect-error - createTableQuery is not yet typed
    expectsql(() => queryGenerator.createTableQuery('myTable', { data: sequelize.normalizeDataType(DataTypes.BLOB).toSql() }), {
      default: 'CREATE TABLE IF NOT EXISTS [myTable] ([data] BLOB);',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`data` BLOB) ENGINE=InnoDB;',
      postgres: 'CREATE TABLE IF NOT EXISTS "myTable" ("data" BYTEA);',
      // TODO: Throw an error for invalid options
      'mssql ibmi': new Error(`Cannot read properties of undefined (reading 'uniqueKeys')`),
    });
  });

  it('produces a CREATE TABLE query', () => {
    // @ts-expect-error - createTableQuery is not yet typed
    expectsql(() => queryGenerator.createTableQuery('myTable', { data: sequelize.normalizeDataType(DataTypes.BLOB('long')).toSql() }), {
      default: `CREATE TABLE IF NOT EXISTS [myTable] ([data] LONGBLOB);`,
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`data` LONGBLOB) ENGINE=InnoDB;',
      postgres: 'CREATE TABLE IF NOT EXISTS "myTable" ("data" BYTEA);',
      // TODO: Throw an error for invalid options
      'mssql ibmi': new Error(`Cannot read properties of undefined (reading 'uniqueKeys')`),
      db2: 'CREATE TABLE IF NOT EXISTS "myTable" ("data" BLOB(2G));',
    });
  });

  it('produces a CREATE TABLE query', () => {
    // @ts-expect-error - createTableQuery is not yet typed
    expectsql(() => queryGenerator.createTableQuery('myTable', { title: 'VARCHAR(255)', name: 'VARCHAR(255)' }, { engine: 'MyISAM' }), {
      // TODO: Throw an error for invalid options
      default: 'CREATE TABLE IF NOT EXISTS [myTable] ([title] VARCHAR(255), [name] VARCHAR(255));',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`title` VARCHAR(255), `name` VARCHAR(255)) ENGINE=MyISAM;',
      mssql: `IF OBJECT_ID('[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([title] VARCHAR(255), [name] VARCHAR(255));`,
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("title" VARCHAR(255), "name" VARCHAR(255)); END`,
    });
  });

  it('produces a CREATE TABLE query', () => {
    // @ts-expect-error - createTableQuery is not yet typed
    expectsql(() => queryGenerator.createTableQuery('myTable', { title: 'VARCHAR(255)', name: 'VARCHAR(255)' }, { charset: 'utf8', collate: 'utf8_unicode_ci' }), {
      // TODO: Throw an error for invalid options
      default: 'CREATE TABLE IF NOT EXISTS [myTable] ([title] VARCHAR(255), [name] VARCHAR(255));',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`title` VARCHAR(255), `name` VARCHAR(255)) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE utf8_unicode_ci;',
      mssql: `IF OBJECT_ID('[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([title] VARCHAR(255), [name] VARCHAR(255));`,
      snowflake: `CREATE TABLE IF NOT EXISTS "myTable" ("title" VARCHAR(255), "name" VARCHAR(255)) DEFAULT CHARSET=utf8 COLLATE utf8_unicode_ci;`,
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("title" VARCHAR(255), "name" VARCHAR(255)); END`,
    });
  });

  it('produces a CREATE TABLE query', () => {
    // @ts-expect-error - createTableQuery is not yet typed
    expectsql(() => queryGenerator.createTableQuery('myTable', { title: 'VARCHAR(255)', name: 'VARCHAR(255)' }, { charset: 'latin1' }), {
      // TODO: Throw an error for invalid options
      default: 'CREATE TABLE IF NOT EXISTS [myTable] ([title] VARCHAR(255), [name] VARCHAR(255));',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`title` VARCHAR(255), `name` VARCHAR(255)) ENGINE=InnoDB DEFAULT CHARSET=latin1;',
      mssql: `IF OBJECT_ID('[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([title] VARCHAR(255), [name] VARCHAR(255));`,
      snowflake: `CREATE TABLE IF NOT EXISTS "myTable" ("title" VARCHAR(255), "name" VARCHAR(255)) DEFAULT CHARSET=latin1;`,
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("title" VARCHAR(255), "name" VARCHAR(255)); END`,
    });
  });

  it('produces a CREATE TABLE query', () => {
    // @ts-expect-error - createTableQuery is not yet typed
    expectsql(() => queryGenerator.createTableQuery('myTable', { title: 'ENUM("A", "B", "C")', name: 'VARCHAR(255)' }), {
      // TODO: Throw an error for invalid options
      default: 'CREATE TABLE IF NOT EXISTS [myTable] ([title] ENUM("A", "B", "C"), [name] VARCHAR(255));',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`title` ENUM("A", "B", "C"), `name` VARCHAR(255)) ENGINE=InnoDB;',
      postgres: 'CREATE TABLE IF NOT EXISTS "myTable" ("title" "public"."enum_myTable_title", "name" VARCHAR(255));',
      'mssql ibmi': new Error(`Cannot read properties of undefined (reading 'uniqueKeys')`),
      snowflake: `CREATE TABLE IF NOT EXISTS "myTable" ("title" ENUM("A", "B", "C"), "name" VARCHAR(255));`,
    });
  });

  it('produces a CREATE TABLE query', () => {
    // @ts-expect-error - createTableQuery is not yet typed
    expectsql(() => queryGenerator.createTableQuery('myTable', { title: 'ENUM("A", "B", "C")', name: 'VARCHAR(255)' }, { charset: 'latin1' }), {
      // TODO: Throw an error for invalid options
      default: 'CREATE TABLE IF NOT EXISTS [myTable] ([title] ENUM("A", "B", "C"), [name] VARCHAR(255));',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`title` ENUM("A", "B", "C"), `name` VARCHAR(255)) ENGINE=InnoDB DEFAULT CHARSET=latin1;',
      postgres: 'CREATE TABLE IF NOT EXISTS "myTable" ("title" "public"."enum_myTable_title", "name" VARCHAR(255));',
      mssql: `IF OBJECT_ID('[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([title] ENUM("A", "B", "C"), [name] VARCHAR(255));`,
      snowflake: `CREATE TABLE IF NOT EXISTS "myTable" ("title" ENUM("A", "B", "C"), "name" VARCHAR(255)) DEFAULT CHARSET=latin1;`,
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("title" ENUM("A", "B", "C"), "name" VARCHAR(255)); END`,
    });
  });

  it('produces a CREATE TABLE query', () => {
    // @ts-expect-error - createTableQuery is not yet typed
    expectsql(() => queryGenerator.createTableQuery('myTable', { title: 'VARCHAR(255)', name: 'VARCHAR(255)' }, { rowFormat: 'default' }), {
      // TODO: Throw an error for invalid options
      default: 'CREATE TABLE IF NOT EXISTS [myTable] ([title] VARCHAR(255), [name] VARCHAR(255));',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`title` VARCHAR(255), `name` VARCHAR(255)) ENGINE=InnoDB ROW_FORMAT=default;',
      mssql: `IF OBJECT_ID('[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([title] VARCHAR(255), [name] VARCHAR(255));`,
      snowflake: `CREATE TABLE IF NOT EXISTS "myTable" ("title" VARCHAR(255), "name" VARCHAR(255)) ROW_FORMAT=default;`,
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("title" VARCHAR(255), "name" VARCHAR(255)); END`,
    });
  });

  it('produces a CREATE TABLE query', () => {
    // @ts-expect-error - createTableQuery is not yet typed
    expectsql(() => queryGenerator.createTableQuery('myTable', { title: 'VARCHAR(255)', name: 'VARCHAR(255)', id: 'INTEGER PRIMARY KEY' }), {
      // TODO: Throw an error for invalid options
      default: 'CREATE TABLE IF NOT EXISTS [myTable] ([title] VARCHAR(255), [name] VARCHAR(255), [id] INTEGER, PRIMARY KEY ([id]));',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`title` VARCHAR(255), `name` VARCHAR(255), `id` INTEGER, PRIMARY KEY (`id`)) ENGINE=InnoDB;',
      sqlite: 'CREATE TABLE IF NOT EXISTS `myTable` (`title` VARCHAR(255), `name` VARCHAR(255), `id` INTEGER PRIMARY KEY);',
      'mssql ibmi': new Error(`Cannot read properties of undefined (reading 'uniqueKeys')`),
    });
  });

  it('produces a CREATE TABLE query', () => {
    if (['mariadb', 'mysql', 'sqlite'].includes(dialectName)) {
      // @ts-expect-error - createTableQuery is not yet typed
      expectsql(() => queryGenerator.createTableQuery('myTable', { title: 'VARCHAR(255)', name: 'VARCHAR(255)', otherId: 'INTEGER REFERENCES `otherTable` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION' }), {
        'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`title` VARCHAR(255), `name` VARCHAR(255), `otherId` INTEGER, FOREIGN KEY (`otherId`) REFERENCES `otherTable` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION) ENGINE=InnoDB;',
        sqlite: 'CREATE TABLE IF NOT EXISTS `myTable` (`title` VARCHAR(255), `name` VARCHAR(255), `otherId` INTEGER REFERENCES `otherTable` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION);',
      });
    }

    if (['postgres', 'snowflake', 'ibmi'].includes(dialectName)) {
      // @ts-expect-error - createTableQuery is not yet typed
      expectsql(() => queryGenerator.createTableQuery('myTable', { title: 'VARCHAR(255)', name: 'VARCHAR(255)', otherId: 'INTEGER REFERENCES "otherTable" ("id") ON DELETE CASCADE ON UPDATE NO ACTION' }), {
        postgres: 'CREATE TABLE IF NOT EXISTS "myTable" ("title" VARCHAR(255), "name" VARCHAR(255), "otherId" INTEGER REFERENCES "otherTable" ("id") ON DELETE CASCADE ON UPDATE NO ACTION);',
        snowflake: 'CREATE TABLE IF NOT EXISTS "myTable" ("title" VARCHAR(255), "name" VARCHAR(255), "otherId" INTEGER, FOREIGN KEY ("otherId") REFERENCES "otherTable" ("id") ON DELETE CASCADE ON UPDATE NO ACTION);',
        ibmi: new Error(`Cannot read properties of undefined (reading 'uniqueKeys')`),
      });
    }

    if (dialectName === 'mssql') {
      // @ts-expect-error - createTableQuery is not yet typed
      expectsql(() => queryGenerator.createTableQuery('myTable', { title: 'VARCHAR(255)', name: 'VARCHAR(255)', otherId: 'INTEGER REFERENCES [otherTable] ([id]) ON DELETE CASCADE ON UPDATE NO ACTION' }), {
        mssql: new Error(`Cannot read properties of undefined (reading 'uniqueKeys')`),
      });
    }

    if (dialectName === 'db2') {
      // @ts-expect-error - createTableQuery is not yet typed
      expectsql(() => queryGenerator.createTableQuery('myTable', { title: 'VARCHAR(255)', name: 'VARCHAR(255)', otherId: 'INTEGER REFERENCES otherTable (id) ON DELETE CASCADE ON UPDATE NO ACTION' }), {
        db2: 'CREATE TABLE IF NOT EXISTS "myTable" ("title" VARCHAR(255), "name" VARCHAR(255), "otherId" INTEGER, FOREIGN KEY ("otherId") REFERENCES otherTable (id) ON DELETE CASCADE ON UPDATE NO ACTION);',
      });
    }
  });

  it('produces a CREATE TABLE query', () => {
    // @ts-expect-error - createTableQuery is not yet typed
    expectsql(() => queryGenerator.createTableQuery('myTable', { title: 'VARCHAR(255)', name: 'VARCHAR(255)' }, { uniqueKeys: [{ fields: ['title', 'name'], customIndex: true }] }), {
      default: 'CREATE TABLE IF NOT EXISTS [myTable] ([title] VARCHAR(255), [name] VARCHAR(255), UNIQUE [uniq_myTable_title_name] ([title], [name]));',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`title` VARCHAR(255), `name` VARCHAR(255), UNIQUE `uniq_myTable_title_name` (`title`, `name`)) ENGINE=InnoDB;',
      postgres: 'CREATE TABLE IF NOT EXISTS "myTable" ("title" VARCHAR(255), "name" VARCHAR(255), CONSTRAINT "my_table_title_name" UNIQUE ("title", "name"));',
      mssql: `IF OBJECT_ID('[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([title] VARCHAR(255), [name] VARCHAR(255), CONSTRAINT [my_table_title_name] UNIQUE ([title], [name]));`,
      // TODO: Throw an error for invalid options
      sqlite: 'CREATE TABLE IF NOT EXISTS `myTable` (`title` VARCHAR(255), `name` VARCHAR(255));',
      db2: `CREATE TABLE IF NOT EXISTS "myTable" ("title" VARCHAR(255) NOT NULL, "name" VARCHAR(255) NOT NULL, CONSTRAINT "uniq_myTable_title_name" UNIQUE ("title", "name"));`,
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("title" VARCHAR(255), "name" VARCHAR(255), CONSTRAINT "uniq_myTable_title_name" UNIQUE ("title", "name")); END`,
    });
  });

  it('produces a CREATE TABLE query', () => {
    // @ts-expect-error - createTableQuery is not yet typed
    expectsql(() => queryGenerator.createTableQuery('myTable', { id: 'INTEGER PRIMARY KEY AUTOINCREMENT', name: 'VARCHAR(255)', surname: 'VARCHAR(255)' }, { uniqueKeys: { uniqueConstraint: { fields: ['name', 'surname'], customIndex: true } } }), {
      default: 'CREATE TABLE IF NOT EXISTS [myTable] ([id] INTEGER AUTOINCREMENT, [name] VARCHAR(255), [surname] VARCHAR(255), UNIQUE [uniqueConstraint] ([name], [surname]), PRIMARY KEY ([id]));',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`id` INTEGER AUTOINCREMENT, `name` VARCHAR(255), `surname` VARCHAR(255), UNIQUE `uniqueConstraint` (`name`, `surname`), PRIMARY KEY (`id`)) ENGINE=InnoDB;',
      postgres: 'CREATE TABLE IF NOT EXISTS "myTable" ("id" INTEGER AUTOINCREMENT, "name" VARCHAR(255), "surname" VARCHAR(255), CONSTRAINT "uniqueConstraint" UNIQUE ("name", "surname"), PRIMARY KEY ("id"));',
      mssql: `IF OBJECT_ID('[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([id] INTEGER AUTOINCREMENT, [name] VARCHAR(255), [surname] VARCHAR(255), CONSTRAINT [uniqueConstraint] UNIQUE ([name], [surname]), PRIMARY KEY ([id]));`,
      // SQLITE does not respect the index name when the index is created through CREATE TABLE
      // As such, Sequelize's createTable does not add the constraint in the Sequelize Dialect.
      // Instead, `sequelize.sync` calls CREATE INDEX after the table has been created,
      // as that query *does* respect the index name.
      sqlite: 'CREATE TABLE IF NOT EXISTS `myTable` (`id` INTEGER PRIMARY KEY AUTOINCREMENT, `name` VARCHAR(255), `surname` VARCHAR(255));',
      db2: 'CREATE TABLE IF NOT EXISTS "myTable" ("id" INTEGER AUTOINCREMENT, "name" VARCHAR(255) NOT NULL, "surname" VARCHAR(255) NOT NULL, CONSTRAINT "uniqueConstraint" UNIQUE ("name", "surname"), PRIMARY KEY ("id"));',
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("id" INTEGER AUTOINCREMENT, "name" VARCHAR(255), "surname" VARCHAR(255), CONSTRAINT "uniqueConstraint" UNIQUE ("name", "surname"), PRIMARY KEY ("id")); END`,
    });
  });

  it('produces a CREATE TABLE query', () => {
    // @ts-expect-error - createTableQuery is not yet typed
    expectsql(() => queryGenerator.createTableQuery('myTable', { title: 'VARCHAR BINARY(255)', number: 'INTEGER(5) UNSIGNED PRIMARY KEY ' }), { // length and unsigned are not allowed on primary key
      // TODO: Throw an error for invalid options
      default: 'CREATE TABLE IF NOT EXISTS [myTable] ([title] VARCHAR BINARY(255), [number] INTEGER(5) UNSIGNED, PRIMARY KEY ([number]));',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`title` VARCHAR BINARY(255), `number` INTEGER(5) UNSIGNED, PRIMARY KEY (`number`)) ENGINE=InnoDB;',
      'mssql ibmi': new Error(`Cannot read properties of undefined (reading 'uniqueKeys')`),
      sqlite: 'CREATE TABLE IF NOT EXISTS `myTable` (`title` VARCHAR BINARY(255), `number` INTEGER PRIMARY KEY);',
    });
  });

  it('produces a CREATE TABLE query', () => {
    // @ts-expect-error - createTableQuery is not yet typed
    expectsql(() => queryGenerator.createTableQuery('myTable', { int: 'INTEGER', bigint: 'BIGINT', smallint: 'SMALLINT' }), {
      // TODO: Throw an error for invalid options
      default: 'CREATE TABLE IF NOT EXISTS [myTable] ([int] INTEGER, [bigint] BIGINT, [smallint] SMALLINT);',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`int` INTEGER, `bigint` BIGINT, `smallint` SMALLINT) ENGINE=InnoDB;',
      'mssql ibmi': new Error(`Cannot read properties of undefined (reading 'uniqueKeys')`),
    });
  });

  it('produces a CREATE TABLE query', () => {
    // @ts-expect-error - createTableQuery is not yet typed
    expectsql(() => queryGenerator.createTableQuery('myTable', { serial: 'INTEGER SERIAL', bigserial: 'BIGINT SERIAL', smallserial: 'SMALLINT SERIAL' }), {
      // TODO: Throw an error for invalid options
      default: 'CREATE TABLE IF NOT EXISTS [myTable] ([serial] INTEGER SERIAL, [bigserial] BIGINT SERIAL, [smallserial] SMALLINT SERIAL);',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`serial` INTEGER SERIAL, `bigserial` BIGINT SERIAL, `smallserial` SMALLINT SERIAL) ENGINE=InnoDB;',
      postgres: 'CREATE TABLE IF NOT EXISTS "myTable" ("serial"  SERIAL, "bigserial"  BIGSERIAL, "smallserial"  SMALLSERIAL);',
      'mssql ibmi': new Error(`Cannot read properties of undefined (reading 'uniqueKeys')`),
    });
  });

  it('produces a CREATE TABLE query', () => {
    // @ts-expect-error - createTableQuery is not yet typed
    expectsql(() => queryGenerator.createTableQuery('myTable', { int: 'INTEGER COMMENT Test', foo: 'INTEGER COMMENT Foo Comment' }), {
      // TODO: Throw an error for invalid options
      default: `CREATE TABLE IF NOT EXISTS [myTable] ([int] INTEGER COMMENT Test, [foo] INTEGER COMMENT Foo Comment);`,
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`int` INTEGER COMMENT Test, `foo` INTEGER COMMENT Foo Comment) ENGINE=InnoDB;',
      postgres: `CREATE TABLE IF NOT EXISTS "myTable" ("int" INTEGER, "foo" INTEGER ); COMMENT ON COLUMN "myTable"."int" IS 'Test'; COMMENT ON COLUMN "myTable"."foo" IS 'Foo Comment';`,
      'mssql ibmi': new Error(`Cannot read properties of undefined (reading 'uniqueKeys')`),
      db2: new Error(`Cannot read properties of undefined (reading 'replacements')`),
    });
  });

  it('produces a CREATE TABLE query', () => {
    // @ts-expect-error - createTableQuery is not yet typed
    expectsql(() => queryGenerator.createTableQuery('myTable', { id: 'INTEGER PRIMARY KEY AUTOINCREMENT', name: 'VARCHAR(255)' }), {
      default: 'CREATE TABLE IF NOT EXISTS [myTable] ([id] INTEGER AUTOINCREMENT, [name] VARCHAR(255), PRIMARY KEY ([id]));',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`id` INTEGER AUTOINCREMENT, `name` VARCHAR(255), PRIMARY KEY (`id`)) ENGINE=InnoDB;',
      sqlite: 'CREATE TABLE IF NOT EXISTS `myTable` (`id` INTEGER PRIMARY KEY AUTOINCREMENT, `name` VARCHAR(255));',
      // TODO: Throw an error for invalid options
      'mssql ibmi': new Error(`Cannot read properties of undefined (reading 'uniqueKeys')`),
    });
  });

  it('produces a CREATE TABLE query', () => {
    // @ts-expect-error - createTableQuery is not yet typed
    expectsql(() => queryGenerator.createTableQuery('myTable', { id: 'INTEGER(4) PRIMARY KEY AUTOINCREMENT', name: 'VARCHAR(255)' }), {
      default: 'CREATE TABLE IF NOT EXISTS [myTable] ([id] INTEGER(4) AUTOINCREMENT, [name] VARCHAR(255), PRIMARY KEY ([id]));',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`id` INTEGER(4) AUTOINCREMENT, `name` VARCHAR(255), PRIMARY KEY (`id`)) ENGINE=InnoDB;',
      sqlite: 'CREATE TABLE IF NOT EXISTS `myTable` (`id` INTEGER PRIMARY KEY AUTOINCREMENT, `name` VARCHAR(255));',
      // TODO: Throw an error for invalid options
      'mssql ibmi': new Error(`Cannot read properties of undefined (reading 'uniqueKeys')`),
    });
  });

  it('produces a CREATE TABLE query', () => {
    // @ts-expect-error - createTableQuery is not yet typed
    expectsql(() => queryGenerator.createTableQuery('myTable', { id: 'SMALLINT(4) PRIMARY KEY AUTOINCREMENT UNSIGNED', name: 'VARCHAR(255)' }), {
      default: 'CREATE TABLE IF NOT EXISTS [myTable] ([id] SMALLINT(4) AUTOINCREMENT UNSIGNED, [name] VARCHAR(255), PRIMARY KEY ([id]));',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`id` SMALLINT(4) AUTOINCREMENT UNSIGNED, `name` VARCHAR(255), PRIMARY KEY (`id`)) ENGINE=InnoDB;',
      sqlite: 'CREATE TABLE IF NOT EXISTS `myTable` (`id` INTEGER PRIMARY KEY AUTOINCREMENT, `name` VARCHAR(255));',
      // TODO: Throw an error for invalid options
      'mssql ibmi': new Error(`Cannot read properties of undefined (reading 'uniqueKeys')`),
    });
  });

  it('produces a CREATE TABLE query', () => {
    // @ts-expect-error - createTableQuery is not yet typed
    expectsql(() => queryGenerator.createTableQuery('myTable', { foo1: 'INTEGER PRIMARY KEY NOT NULL', foo2: 'INTEGER PRIMARY KEY NOT NULL' }), {
      default: 'CREATE TABLE IF NOT EXISTS [myTable] ([foo1] INTEGER NOT NULL, [foo2] INTEGER NOT NULL, PRIMARY KEY ([foo1], [foo2]));',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`foo1` INTEGER NOT NULL, `foo2` INTEGER NOT NULL, PRIMARY KEY (`foo1`, `foo2`)) ENGINE=InnoDB;',
      postgres: 'CREATE TABLE IF NOT EXISTS "myTable" ("foo1" INTEGER NOT NULL, "foo2" INTEGER NOT NULL, PRIMARY KEY ("foo1","foo2"));',
      // TODO: Throw an error for invalid options
      'mssql ibmi': new Error(`Cannot read properties of undefined (reading 'uniqueKeys')`),
    });
  });

  it('produces a CREATE TABLE query', () => {
    // @ts-expect-error - createTableQuery is not yet typed
    expectsql(() => queryGenerator.createTableQuery('myTable', { id: 'INTEGER auto_increment PRIMARY KEY' }, { initialAutoIncrement: 1_000_001 }), {
      // TODO: Throw an error for invalid options
      default: 'CREATE TABLE IF NOT EXISTS [myTable] ([id] INTEGER auto_increment, PRIMARY KEY ([id]));',
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `myTable` (`id` INTEGER auto_increment , PRIMARY KEY (`id`)) ENGINE=InnoDB AUTO_INCREMENT=1000001;',
      mssql: `IF OBJECT_ID('[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([id] INTEGER auto_increment , PRIMARY KEY ([id]));`,
      sqlite: 'CREATE TABLE IF NOT EXISTS `myTable` (`id` INTEGER PRIMARY KEY);',
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "myTable" ("id" INTEGER auto_increment, PRIMARY KEY ("id")); END`,
    });
  });
});
