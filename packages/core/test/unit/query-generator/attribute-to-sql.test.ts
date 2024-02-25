import { DataTypes, Deferrable, fn } from '@sequelize/core';
import { expectPerDialect, sequelize } from '../../support';

const dialect = sequelize.dialect;

// TODO: use a structure like in where.test.ts instead of the names
// TODO: add describe blocks to combine tests on same options (like defaultValue and onDelete/onUpdate)
// TODO: add few tests that combine multiple options

describe('QueryGenerator#attributeToSQL', () => {
  const queryGenerator = sequelize.queryGenerator;

  it(`string as attribute`, () => {
    // @ts-expect-error -- Untyped method
    expectPerDialect(() => queryGenerator.attributeToSQL('INTEGER'), {
      default: 'INTEGER',
      mssql: 'INTEGER NULL',
    });
  });

  it(`DataType as attribute`, () => {
    expectPerDialect(
      // @ts-expect-error -- Untyped method
      () => queryGenerator.attributeToSQL(sequelize.normalizeDataType(DataTypes.INTEGER)),
      {
        default: 'INTEGER',
        mssql: 'INTEGER NULL',
      },
    );
  });

  it(`attribute with string type`, () => {
    // @ts-expect-error -- Untyped method
    expectPerDialect(() => queryGenerator.attributeToSQL({ type: 'INTEGER' }), {
      default: 'INTEGER',
      mssql: 'INTEGER NULL',
    });
  });

  it(`attribute with DataType type`, () => {
    expectPerDialect(
      // @ts-expect-error -- Untyped method
      () => queryGenerator.attributeToSQL({ type: sequelize.normalizeDataType(DataTypes.INTEGER) }),
      {
        default: 'INTEGER',
        mssql: 'INTEGER NULL',
      },
    );
  });

  it(`enum attribute`, () => {
    expectPerDialect(
      () =>
        // @ts-expect-error -- Untyped method
        queryGenerator.attributeToSQL({
          type: sequelize.normalizeDataType(DataTypes.ENUM('value1', 'value2')),
        }),
      {
        default: `ENUM('value1', 'value2')`,
        'mssql db2 ibmi': new Error('quoteIdentifier received a non-string identifier:'),
        snowflake: 'VARCHAR(255)',
        sqlite: 'TEXT',
      },
    );
  });

  it(`enum attribute with field`, () => {
    expectPerDialect(
      () =>
        // @ts-expect-error -- Untyped method
        queryGenerator.attributeToSQL({
          type: sequelize.normalizeDataType(DataTypes.ENUM('value1', 'value2')),
          field: 'foo',
        }),
      {
        default: `ENUM('value1', 'value2')`,
        mssql: `NVARCHAR(255) CHECK ([foo] IN(N'value1', N'value2'))`,
        snowflake: 'VARCHAR(255)',
        sqlite: 'TEXT',
        'db2 ibmi': `VARCHAR(255) CHECK ("foo" IN('value1', 'value2'))`,
      },
    );
  });

  it(`enum attribute with field and context changeColumn`, () => {
    expectPerDialect(
      () =>
        // @ts-expect-error -- Untyped method
        queryGenerator.attributeToSQL(
          {
            type: sequelize.normalizeDataType(DataTypes.ENUM('value1', 'value2')),
            field: 'foo',
          },
          {
            context: 'changeColumn',
          },
        ),
      {
        default: `ENUM('value1', 'value2')`,
        mssql: `NVARCHAR(255) CHECK ([foo] IN(N'value1', N'value2'))`,
        snowflake: 'VARCHAR(255)',
        sqlite: 'TEXT',
        db2: `DATA TYPE VARCHAR(255) CHECK ("foo" IN('value1', 'value2'))`,
        ibmi: `VARCHAR(255) ADD CHECK ("foo" IN('value1', 'value2'))`,
      },
    );
  });

  if (dialect.supports.dataTypes.ARRAY) {
    it(`enum array attribute`, () => {
      expectPerDialect(
        () =>
          // @ts-expect-error -- Untyped method
          queryGenerator.attributeToSQL({
            type: DataTypes.ARRAY({
              type: DataTypes.ENUM('value1', 'value2'),
            }),
          }),
        {
          default: `ENUM('value1', 'value2')[]`,
        },
      );
    });
  }

  it(`attribute with field`, () => {
    expectPerDialect(
      // @ts-expect-error -- Untyped method
      () => queryGenerator.attributeToSQL({ type: 'INTEGER', field: 'foo' }),
      {
        default: 'INTEGER',
        mssql: 'INTEGER NULL',
      },
    );
  });

  it(`attribute with allowNull false`, () => {
    // @ts-expect-error -- Untyped method
    expectPerDialect(() => queryGenerator.attributeToSQL({ type: 'INTEGER', allowNull: false }), {
      default: 'INTEGER NOT NULL',
    });
  });

  it(`attribute with allowNull true with changeColumn`, () => {
    expectPerDialect(
      () =>
        // @ts-expect-error -- Untyped method
        queryGenerator.attributeToSQL(
          { type: 'INTEGER', allowNull: true },
          { context: 'changeColumn' },
        ),
      {
        default: 'INTEGER',
        mssql: 'INTEGER NULL',
        db2: ['DATA TYPE INTEGER', 'DROP NOT NULL'],
        ibmi: 'INTEGER DROP NOT NULL',
      },
    );
  });

  it(`attribute with allowNull false with changeColumn`, () => {
    expectPerDialect(
      () =>
        // @ts-expect-error -- Untyped method
        queryGenerator.attributeToSQL(
          { type: 'INTEGER', allowNull: false },
          { context: 'changeColumn' },
        ),
      {
        default: 'INTEGER NOT NULL',
        db2: ['DATA TYPE INTEGER', 'NOT NULL'],
      },
    );
  });

  it(`attribute with autoIncrement`, () => {
    expectPerDialect(
      // @ts-expect-error -- Untyped method
      () => queryGenerator.attributeToSQL({ type: 'INTEGER', autoIncrement: true }),
      {
        default: 'INTEGER auto_increment',
        postgres: 'INTEGER SERIAL',
        mssql: 'INTEGER NULL IDENTITY(1,1)',
        snowflake: 'INTEGER AUTOINCREMENT',
        sqlite: 'INTEGER',
        db2: 'INTEGER GENERATED BY DEFAULT AS IDENTITY(START WITH 1, INCREMENT BY 1)',
        ibmi: 'INTEGER GENERATED BY DEFAULT AS IDENTITY (START WITH 1, INCREMENT BY 1)',
      },
    );
  });

  it(`attribute with autoIncrement and primaryKey`, () => {
    expectPerDialect(
      () =>
        // @ts-expect-error -- Untyped method
        queryGenerator.attributeToSQL({ type: 'INTEGER', autoIncrement: true, primaryKey: true }),
      {
        default: 'INTEGER auto_increment PRIMARY KEY',
        postgres: 'INTEGER SERIAL PRIMARY KEY',
        mssql: 'INTEGER IDENTITY(1,1) PRIMARY KEY',
        'snowflake sqlite': 'INTEGER AUTOINCREMENT PRIMARY KEY',
        db2: 'INTEGER NOT NULL GENERATED BY DEFAULT AS IDENTITY(START WITH 1, INCREMENT BY 1) PRIMARY KEY',
        ibmi: 'INTEGER GENERATED BY DEFAULT AS IDENTITY (START WITH 1, INCREMENT BY 1) PRIMARY KEY',
      },
    );
  });

  it(`attribute with autoIncrement and initialAutoIncrement`, () => {
    expectPerDialect(
      () =>
        // @ts-expect-error -- Untyped method
        queryGenerator.attributeToSQL({
          type: 'INTEGER',
          autoIncrement: true,
          initialAutoIncrement: 5,
        }),
      {
        default: 'INTEGER auto_increment',
        postgres: 'INTEGER SERIAL',
        mssql: 'INTEGER NULL IDENTITY(1,1)',
        snowflake: 'INTEGER AUTOINCREMENT',
        sqlite: 'INTEGER',
        db2: 'INTEGER GENERATED BY DEFAULT AS IDENTITY(START WITH 5, INCREMENT BY 1)',
        ibmi: 'INTEGER GENERATED BY DEFAULT AS IDENTITY (START WITH 1, INCREMENT BY 1)',
      },
    );
  });

  it(`attribute with autoIncrement and autoIncrementIdentity`, () => {
    expectPerDialect(
      () =>
        // @ts-expect-error -- Untyped method
        queryGenerator.attributeToSQL({
          type: 'INTEGER',
          autoIncrement: true,
          autoIncrementIdentity: true,
        }),
      {
        default: 'INTEGER auto_increment',
        postgres: 'INTEGER GENERATED BY DEFAULT AS IDENTITY',
        mssql: 'INTEGER NULL IDENTITY(1,1)',
        snowflake: 'INTEGER AUTOINCREMENT',
        sqlite: 'INTEGER',
        db2: 'INTEGER GENERATED BY DEFAULT AS IDENTITY(START WITH 1, INCREMENT BY 1)',
        ibmi: 'INTEGER GENERATED BY DEFAULT AS IDENTITY (START WITH 1, INCREMENT BY 1)',
      },
    );
  });

  it(`attribute with unique`, () => {
    expectPerDialect(
      // @ts-expect-error -- Untyped method
      () => queryGenerator.attributeToSQL({ type: 'INTEGER', unique: true }),
      {
        default: 'INTEGER UNIQUE',
        mssql: 'INTEGER NULL UNIQUE',
      },
    );
  });

  it(`attribute with unique for changeColumn`, () => {
    expectPerDialect(
      () =>
        // @ts-expect-error -- Untyped method
        queryGenerator.attributeToSQL(
          { type: 'INTEGER', unique: true },
          { context: 'changeColumn' },
        ),
      {
        default: 'INTEGER UNIQUE',
        mssql: 'INTEGER NULL',
        db2: 'DATA TYPE INTEGER',
      },
    );
  });

  it(`attribute with primaryKey`, () => {
    expectPerDialect(
      // @ts-expect-error -- Untyped method
      () => queryGenerator.attributeToSQL({ type: 'INTEGER', primaryKey: true }),
      {
        default: 'INTEGER PRIMARY KEY',
        db2: 'INTEGER NOT NULL PRIMARY KEY',
      },
    );
  });

  it(`attribute with comment`, () => {
    expectPerDialect(
      // @ts-expect-error -- Untyped method
      () => queryGenerator.attributeToSQL({ type: 'INTEGER', comment: 'Foo' }),
      {
        default: `INTEGER COMMENT 'Foo'`,
        'postgres db2': 'INTEGER COMMENT Foo',
        mssql: 'INTEGER NULL COMMENT Foo',
        'sqlite ibmi': 'INTEGER',
      },
    );
  });

  it(`attribute with comment prone to SQL injection`, () => {
    expectPerDialect(
      () =>
        // @ts-expect-error -- Untyped method
        queryGenerator.attributeToSQL({
          type: 'INTEGER',
          comment: "'); DELETE YOLO INJECTIONS; -- ",
        }),
      {
        default: `INTEGER COMMENT '\\'); DELETE YOLO INJECTIONS; -- '`,
        // Normally a context is given and this is only used for createTable where comments are quoted there so this is fine for now
        postgres: "INTEGER COMMENT '); DELETE YOLO INJECTIONS; -- ",
        mssql: "INTEGER NULL COMMENT '\\'); DELETE YOLO INJECTIONS; -- '",
        'sqlite ibmi': 'INTEGER',
      },
    );
  });

  it(`attribute with comment on column`, () => {
    expectPerDialect(
      () =>
        // @ts-expect-error -- Untyped method
        queryGenerator.attributeToSQL(
          { type: 'INTEGER', comment: 'Foo' },
          { context: 'addColumn', key: 'id', table: 'bar' },
        ),
      {
        default: `INTEGER COMMENT 'Foo'`,
        postgres: `INTEGER; COMMENT ON COLUMN "bar"."id" IS 'Foo'`,
        mssql: 'INTEGER NULL COMMENT Foo',
        'sqlite ibmi': 'INTEGER',
        db2: 'INTEGER COMMENT Foo',
      },
    );
  });

  it(`attribute with first`, () => {
    expectPerDialect(
      // @ts-expect-error -- Untyped method
      () => queryGenerator.attributeToSQL({ type: 'INTEGER', first: true }),
      {
        default: 'INTEGER FIRST',
        'postgres sqlite db2': 'INTEGER',
        mssql: 'INTEGER NULL',
      },
    );
  });

  it(`attribute with after`, () => {
    expectPerDialect(
      // @ts-expect-error -- Untyped method
      () => queryGenerator.attributeToSQL({ type: 'INTEGER', after: 'bar' }),
      {
        default: 'INTEGER AFTER `bar`',
        'postgres sqlite db2': 'INTEGER',
        mssql: 'INTEGER NULL',
        'snowflake ibmi': 'INTEGER AFTER "bar"',
      },
    );
  });

  it(`attribute with withoutForeignKeyConstraints`, () => {
    expectPerDialect(
      // @ts-expect-error -- Untyped method
      () => queryGenerator.attributeToSQL({ type: 'INTEGER', withoutForeignKeyConstraints: true }),
      {
        default: 'INTEGER',
        mssql: 'INTEGER NULL',
      },
    );
  });

  it(`attribute with defaultValue`, () => {
    expectPerDialect(
      // @ts-expect-error -- Untyped method
      () => queryGenerator.attributeToSQL({ type: 'INTEGER', defaultValue: 2 }),
      {
        default: 'INTEGER DEFAULT 2',
      },
    );
  });

  it(`attribute with defaultValue true`, () => {
    expectPerDialect(
      // @ts-expect-error -- Untyped method
      () => queryGenerator.attributeToSQL({ type: 'INTEGER', defaultValue: true }),
      {
        default: 'INTEGER DEFAULT true',
        'mssql sqlite ibmi': 'INTEGER DEFAULT 1',
      },
    );
  });

  it(`attribute with defaultValue false`, () => {
    expectPerDialect(
      // @ts-expect-error -- Untyped method
      () => queryGenerator.attributeToSQL({ type: 'INTEGER', defaultValue: false }),
      {
        default: 'INTEGER DEFAULT false',
        'mssql sqlite ibmi': 'INTEGER DEFAULT 0',
      },
    );
  });

  it(`attributes without defaultValue in some dialects`, () => {
    expectPerDialect(
      () =>
        // @ts-expect-error -- Untyped method
        queryGenerator.attributeToSQL({
          type: sequelize.normalizeDataType(DataTypes.INTEGER),
          defaultValue: undefined,
        }),
      {
        default: 'INTEGER',
        mssql: 'INTEGER NULL',
      },
    );

    expectPerDialect(
      () =>
        // @ts-expect-error -- Untyped method
        queryGenerator.attributeToSQL({
          type: sequelize.normalizeDataType(DataTypes.INTEGER),
          defaultValue: fn('NOW'),
        }),
      {
        default: 'INTEGER DEFAULT NOW()',
        mysql: 'INTEGER DEFAULT (NOW())',
      },
    );

    if (dialect.supports.dataTypes.COLLATE_BINARY) {
      expectPerDialect(
        () =>
          // @ts-expect-error -- Untyped method
          queryGenerator.attributeToSQL({
            type: sequelize.normalizeDataType(DataTypes.STRING.BINARY),
            defaultValue: 'default',
          }),
        {
          default: 'VARCHAR(255) BINARY',
          sqlite: `TEXT COLLATE BINARY DEFAULT 'default'`,
          'db2 ibmi': 'VARCHAR(255) FOR BIT DATA',
        },
      );
    }

    expectPerDialect(
      () =>
        // @ts-expect-error -- Untyped method
        queryGenerator.attributeToSQL({
          type: sequelize.normalizeDataType(DataTypes.BLOB),
          defaultValue: 'default',
        }),
      {
        default: 'BLOB',
        postgres: `BYTEA DEFAULT '\\x64656661756c74'`,
        mssql: 'VARBINARY(MAX) DEFAULT 0x64656661756c74',
        sqlite: `BLOB DEFAULT X'64656661756c74'`,
        db2: `BLOB(1M) DEFAULT BLOB('default')`,
        ibmi: `BLOB(1M) DEFAULT 'default'`,
      },
    );

    expectPerDialect(
      () =>
        // @ts-expect-error -- Untyped method
        queryGenerator.attributeToSQL({
          type: sequelize.normalizeDataType(DataTypes.TEXT),
          defaultValue: 'default',
        }),
      {
        default: 'TEXT',
        'postgres sqlite': `TEXT DEFAULT 'default'`,
        mssql: `NVARCHAR(MAX) DEFAULT N'default'`,
        'db2 ibmi': `CLOB(2147483647) DEFAULT 'default'`,
      },
    );

    if (dialect.supports.dataTypes.GEOMETRY) {
      expectPerDialect(
        () =>
          // @ts-expect-error -- Untyped method
          queryGenerator.attributeToSQL({
            type: sequelize.normalizeDataType(DataTypes.GEOMETRY),
            defaultValue: { type: 'Point', coordinates: [39.807_222, -76.984_722] },
          }),
        {
          default: 'GEOMETRY',
          postgres: `GEOMETRY DEFAULT 'ST_GeomFromGeoJSON(''{"type":"Point","coordinates":[39.807222,-76.984722]}'')'`,
        },
      );
    }

    if (dialect.supports.dataTypes.JSON) {
      expectPerDialect(
        () =>
          // @ts-expect-error -- Untyped method
          queryGenerator.attributeToSQL({
            type: sequelize.normalizeDataType(DataTypes.JSON),
            defaultValue: 'default',
          }),
        {
          default: 'JSON',
          postgres: `JSON DEFAULT '"default"'`,
          mssql: `NVARCHAR(MAX) DEFAULT N'"default"'`,
          sqlite: `TEXT DEFAULT '"default"'`,
        },
      );
    }
  });

  it(`attribute with references with table string`, () => {
    expectPerDialect(
      () =>
        // @ts-expect-error -- Untyped method
        queryGenerator.attributeToSQL({
          type: 'INTEGER',
          references: { table: 'myTable' },
        }),
      {
        default: 'INTEGER REFERENCES "myTable" ("id")',
        'mariadb mysql sqlite': 'INTEGER REFERENCES `myTable` (`id`)',
        mssql: 'INTEGER NULL REFERENCES [myTable] ([id])',
      },
    );
  });

  it(`attribute with references with table string and key`, () => {
    expectPerDialect(
      () =>
        // @ts-expect-error -- Untyped method
        queryGenerator.attributeToSQL({
          type: 'INTEGER',
          references: { table: 'myTable', key: 'foo' },
        }),
      {
        default: 'INTEGER REFERENCES "myTable" ("foo")',
        'mariadb mysql sqlite': 'INTEGER REFERENCES `myTable` (`foo`)',
        mssql: 'INTEGER NULL REFERENCES [myTable] ([foo])',
      },
    );
  });

  it(`attribute with references with table string and key option`, () => {
    expectPerDialect(
      () =>
        // @ts-expect-error -- Untyped method
        queryGenerator.attributeToSQL(
          {
            type: 'INTEGER',
            references: { table: 'myTable' },
          },
          {
            key: 'foo',
          },
        ),
      {
        default: 'INTEGER REFERENCES "myTable" ("id")',
        'mariadb mysql sqlite': 'INTEGER REFERENCES `myTable` (`id`)',
        mssql: 'INTEGER NULL REFERENCES [myTable] ([id])',
      },
    );
  });

  it(`attribute with references with table string and deferrable`, () => {
    expectPerDialect(
      () =>
        // @ts-expect-error -- Untyped method
        queryGenerator.attributeToSQL({
          type: 'INTEGER',
          references: { table: 'myTable', deferrable: Deferrable.INITIALLY_DEFERRED },
        }),
      {
        default: 'INTEGER REFERENCES `myTable` (`id`)',
        postgres: 'INTEGER REFERENCES "myTable" ("id") DEFERRABLE INITIALLY DEFERRED',
        'snowflake db2 ibmi': 'INTEGER REFERENCES "myTable" ("id")',
        mssql: 'INTEGER NULL REFERENCES [myTable] ([id])',
      },
    );
  });

  it(`attribute with references with table string and foreignKey option for addColumn`, () => {
    expectPerDialect(
      () =>
        // @ts-expect-error -- Untyped method
        queryGenerator.attributeToSQL(
          { type: 'INTEGER', references: { table: 'myTable' } },
          { context: 'addColumn', foreignKey: 'bar', tableName: 'otherTable' },
        ),
      {
        default: 'INTEGER REFERENCES "myTable" ("id")',
        'mariadb mysql':
          'INTEGER, ADD CONSTRAINT `otherTable_bar_foreign_idx` FOREIGN KEY (`bar`) REFERENCES `myTable` (`id`)',
        mssql: 'INTEGER NULL REFERENCES [myTable] ([id])',
        snowflake:
          'INTEGER, ADD CONSTRAINT "otherTable_""bar""_foreign_idx" FOREIGN KEY ("bar") REFERENCES "myTable" ("id")',
        sqlite: 'INTEGER REFERENCES `myTable` (`id`)',
        db2: 'INTEGER, CONSTRAINT otherTable_"bar"_fidx FOREIGN KEY ("bar") REFERENCES "myTable" ("id")',
        ibmi: 'INTEGER ADD CONSTRAINT "otherTable_""bar""_foreign_idx" FOREIGN KEY ("bar") REFERENCES "myTable" ("id")',
      },
    );
  });

  it(`attribute with onDelete and onUpdate`, () => {
    expectPerDialect(
      () =>
        // @ts-expect-error -- Untyped method
        queryGenerator.attributeToSQL({
          type: 'INTEGER',
          onUpdate: 'SET NULL',
          onDelete: 'NO ACTION',
        }),
      {
        default: 'INTEGER',
        mssql: 'INTEGER NULL',
      },
    );
  });

  it(`attribute with references with table string with onDelete and onUpdate`, () => {
    expectPerDialect(
      () =>
        // @ts-expect-error -- Untyped method
        queryGenerator.attributeToSQL({
          type: 'INTEGER',
          references: { table: 'myTable' },
          onUpdate: 'SeT NuLl',
          onDelete: 'nO AcTiOn',
        }),
      {
        default: 'INTEGER REFERENCES "myTable" ("id") ON DELETE NO ACTION ON UPDATE SET NULL',
        'mariadb mysql sqlite':
          'INTEGER REFERENCES `myTable` (`id`) ON DELETE NO ACTION ON UPDATE SET NULL',
        mssql: 'INTEGER NULL REFERENCES [myTable] ([id]) ON DELETE NO ACTION ON UPDATE SET NULL',
      },
    );
  });

  it(`attribute with references and Model, both with table string with onDelete and onUpdate`, () => {
    expectPerDialect(
      () =>
        // @ts-expect-error -- Untyped method
        queryGenerator.attributeToSQL({
          type: 'INTEGER',
          references: { table: 'myTable' },
          Model: { tableName: 'myTable' },
          onUpdate: 'SET NULL',
          onDelete: 'NO ACTION',
        }),
      {
        default: 'INTEGER REFERENCES "myTable" ("id") ON DELETE NO ACTION ON UPDATE SET NULL',
        'mariadb mysql sqlite':
          'INTEGER REFERENCES `myTable` (`id`) ON DELETE NO ACTION ON UPDATE SET NULL',
        mssql: 'INTEGER NULL REFERENCES [myTable] ([id])',
      },
    );
  });

  it(`attribute with references with table string with onUpdate CASCADE`, () => {
    expectPerDialect(
      () =>
        // @ts-expect-error -- Untyped method
        queryGenerator.attributeToSQL({
          type: 'INTEGER',
          references: { table: 'myTable' },
          onUpdate: 'CASCADE',
        }),
      {
        default: 'INTEGER REFERENCES `myTable` (`id`) ON UPDATE CASCADE',
        'postgres snowflake': 'INTEGER REFERENCES "myTable" ("id") ON UPDATE CASCADE',
        'db2 ibmi': 'INTEGER REFERENCES "myTable" ("id")',
        mssql: 'INTEGER NULL REFERENCES [myTable] ([id]) ON UPDATE CASCADE',
      },
    );
  });

  it(`attribute with references with table string with empty onDelete and empty onUpdate`, () => {
    expectPerDialect(
      () =>
        // @ts-expect-error -- Untyped method
        queryGenerator.attributeToSQL({
          type: 'INTEGER',
          references: { table: 'myTable' },
          onUpdate: '',
          onDelete: '',
        }),
      {
        default: 'INTEGER REFERENCES "myTable" ("id")',
        'mariadb mysql sqlite': 'INTEGER REFERENCES `myTable` (`id`)',
        mssql: 'INTEGER NULL REFERENCES [myTable] ([id])',
      },
    );
  });

  it(`attribute with references with table string with onDelete, onUpdate and unique`, () => {
    expectPerDialect(
      () =>
        // @ts-expect-error -- Untyped method
        queryGenerator.attributeToSQL({
          type: 'INTEGER',
          references: { table: 'myTable' },
          onUpdate: 'SET NULL',
          onDelete: 'NO ACTION',
          unique: true,
        }),
      {
        default:
          'INTEGER UNIQUE REFERENCES "myTable" ("id") ON DELETE NO ACTION ON UPDATE SET NULL',
        'mariadb mysql sqlite':
          'INTEGER UNIQUE REFERENCES `myTable` (`id`) ON DELETE NO ACTION ON UPDATE SET NULL',
        mssql:
          'INTEGER NULL UNIQUE REFERENCES [myTable] ([id]) ON DELETE NO ACTION ON UPDATE SET NULL',
      },
    );
  });

  it(`attribute with combination (1)`, () => {
    expectPerDialect(
      () =>
        // @ts-expect-error -- Untyped method
        queryGenerator.attributeToSQL({
          type: 'INTEGER',
          allowNull: false,
          autoIncrement: true,
          defaultValue: 1,
          references: { table: 'Bar' },
          onDelete: 'CASCADE',
          onUpdate: 'RESTRICT',
        }),
      {
        default:
          'INTEGER NOT NULL auto_increment DEFAULT 1 REFERENCES `Bar` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT',
        postgres:
          'INTEGER NOT NULL SERIAL DEFAULT 1 REFERENCES "Bar" ("id") ON DELETE CASCADE ON UPDATE RESTRICT',
        mssql:
          'INTEGER NOT NULL IDENTITY(1,1) DEFAULT 1 REFERENCES [Bar] ([id]) ON DELETE CASCADE ON UPDATE RESTRICT',
        snowflake:
          'INTEGER NOT NULL AUTOINCREMENT DEFAULT 1 REFERENCES "Bar" ("id") ON DELETE CASCADE ON UPDATE RESTRICT',
        sqlite:
          'INTEGER NOT NULL DEFAULT 1 REFERENCES `Bar` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT',
        db2: 'INTEGER NOT NULL GENERATED BY DEFAULT AS IDENTITY(START WITH 1, INCREMENT BY 1) DEFAULT 1 REFERENCES "Bar" ("id") ON DELETE CASCADE ON UPDATE RESTRICT',
        ibmi: 'INTEGER NOT NULL GENERATED BY DEFAULT AS IDENTITY (START WITH 1, INCREMENT BY 1) DEFAULT 1 REFERENCES "Bar" ("id") ON DELETE CASCADE ON UPDATE RESTRICT',
      },
    );
  });
});
