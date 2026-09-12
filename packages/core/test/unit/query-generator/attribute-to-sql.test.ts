import { DataTypes, fn, literal } from '@sequelize/core';
import type { AbstractQueryGenerator } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/query-generator.js';
import util from 'node:util';
import type { ExpectationRecord } from '../../support';
import {
  allowDeprecationsInSuite,
  createSequelizeInstance,
  createTester,
  expectPerDialect,
  sequelize,
} from '../../support';

const dialectSupports = sequelize.dialect.supports;

type Expectations = ExpectationRecord<string | string[]>;

function createAttributeTester(getQueryGenerator: () => AbstractQueryGenerator) {
  return createTester(
    (
      it,
      // TODO: type this once attributeToSQL is typed
      attribute: any,
      expectations: Expectations,
      // TODO: use AttributeToSqlOptions once attributeToSQL is typed.
      options?: Record<string, unknown>,
    ) => {
      it(
        util.inspect(attribute, { depth: 10 }) + (options ? `, ${util.inspect(options)}` : ''),
        () => {
          return expectPerDialect(
            // @ts-expect-error -- attributeToSQL is not typed yet
            () => getQueryGenerator().attributeToSQL(attribute, options),
            expectations,
          );
        },
      );
    },
  );
}

describe('QueryGenerator#attributeToSQL', () => {
  const testSql = createAttributeTester(() => sequelize.dialect.queryGenerator);

  testSql('INTEGER', {
    default: 'INTEGER',
    'mssql oracle': 'INTEGER NULL',
  });

  testSql(sequelize.normalizeDataType(DataTypes.INTEGER), {
    default: 'INTEGER',
    'mssql oracle': 'INTEGER NULL',
  });

  testSql(
    { type: 'INTEGER' },
    {
      default: 'INTEGER',
      'mssql oracle': 'INTEGER NULL',
    },
  );

  testSql(
    { type: sequelize.normalizeDataType(DataTypes.INTEGER) },
    {
      default: 'INTEGER',
      'mssql oracle': 'INTEGER NULL',
    },
  );

  // TODO: an ENUM without a column name should not throw. mssql, db2, ibmi and oracle build the
  //  CHECK constraint out of `attribute.field`, which nothing guarantees is set when attributeToSQL
  //  is called directly.
  testSql(
    { type: sequelize.normalizeDataType(DataTypes.ENUM('value1', 'value2')) },
    {
      default: new Error('quoteIdentifier received a non-string identifier: undefined'),
      'mariadb mysql postgres': "ENUM('value1', 'value2')",
      sqlite3: 'TEXT',
      snowflake: 'VARCHAR(255)',
    },
  );

  testSql(
    { type: sequelize.normalizeDataType(DataTypes.ENUM('value1', 'value2')), field: 'foo' },
    {
      default: "ENUM('value1', 'value2')",
      'db2 ibmi': `VARCHAR(255) CHECK ("foo" IN('value1', 'value2'))`,
      mssql: "NVARCHAR(255) CHECK ([foo] IN(N'value1', N'value2'))",
      sqlite3: 'TEXT',
      snowflake: 'VARCHAR(255)',
      oracle: `VARCHAR2(512) CHECK ("foo" IN('value1', 'value2'))`,
    },
  );

  testSql(
    { type: sequelize.normalizeDataType(DataTypes.ENUM('value1', 'value2')), field: 'foo' },
    {
      default: "ENUM('value1', 'value2')",
      'db2 ibmi': `VARCHAR(255) CHECK ("foo" IN('value1', 'value2'))`,
      mssql: "NVARCHAR(255) CHECK ([foo] IN(N'value1', N'value2'))",
      sqlite3: 'TEXT',
      snowflake: 'VARCHAR(255)',
      oracle: `VARCHAR2(512) CHECK ("foo" IN('value1', 'value2'))`,
    },
    { context: 'createTable' },
  );

  testSql(
    { type: sequelize.normalizeDataType(DataTypes.ENUM('value1', 'value2')), field: 'foo' },
    {
      default: "ENUM('value1', 'value2')",
      'db2 ibmi': `VARCHAR(255) CHECK ("foo" IN('value1', 'value2'))`,
      mssql: "NVARCHAR(255) CHECK ([foo] IN(N'value1', N'value2'))",
      sqlite3: 'TEXT',
      snowflake: 'VARCHAR(255)',
      oracle: `VARCHAR2(512) CHECK ("foo" IN('value1', 'value2'))`,
    },
    { context: 'addColumn' },
  );

  testSql(
    { type: sequelize.normalizeDataType(DataTypes.ENUM('value1', 'value2')), field: 'foo' },
    {
      default: "ENUM('value1', 'value2')",
      mssql: "NVARCHAR(255) CHECK ([foo] IN(N'value1', N'value2'))",
      sqlite3: 'TEXT',
      snowflake: 'VARCHAR(255)',
      db2: `DATA TYPE VARCHAR(255) CHECK ("foo" IN('value1', 'value2'))`,
      ibmi: `VARCHAR(255) ADD CHECK ("foo" IN('value1', 'value2'))`,
      oracle: `VARCHAR2(512) CHECK ("foo" IN('value1', 'value2'))`,
    },
    { context: 'changeColumn' },
  );

  testSql(
    { type: 'INTEGER', field: 'foo' },
    {
      default: 'INTEGER',
      'mssql oracle': 'INTEGER NULL',
    },
  );

  testSql(
    { type: 'INTEGER', allowNull: false },
    {
      default: 'INTEGER NOT NULL',
    },
  );

  testSql(
    { type: 'INTEGER', allowNull: true },
    {
      default: 'INTEGER',
      'mssql oracle': 'INTEGER NULL',
    },
  );

  testSql(
    { type: 'INTEGER', allowNull: false },
    {
      default: 'INTEGER NOT NULL',
      db2: 'DATA TYPE INTEGER',
      ibmi: 'INTEGER',
    },
    { context: 'changeColumn' },
  );

  testSql(
    { type: 'INTEGER', allowNull: true },
    {
      default: 'INTEGER',
      'mssql oracle': 'INTEGER NULL',
      db2: 'DATA TYPE INTEGER',
    },
    { context: 'changeColumn' },
  );

  testSql(
    { type: 'INTEGER', autoIncrement: true },
    {
      default: 'INTEGER auto_increment',
      postgres: 'INTEGER SERIAL',
      mssql: 'INTEGER NULL IDENTITY(1,1)',
      sqlite3: 'INTEGER',
      snowflake: 'INTEGER AUTOINCREMENT',
      db2: 'INTEGER GENERATED BY DEFAULT AS IDENTITY(START WITH 1, INCREMENT BY 1)',
      ibmi: 'INTEGER GENERATED BY DEFAULT AS IDENTITY (START WITH 1, INCREMENT BY 1)',
      oracle: ' NUMBER(*,0) GENERATED BY DEFAULT ON NULL AS IDENTITY',
    },
  );

  testSql(
    { type: 'INTEGER', autoIncrement: true, primaryKey: true },
    {
      default: 'INTEGER auto_increment PRIMARY KEY',
      postgres: 'INTEGER SERIAL PRIMARY KEY',
      mssql: 'INTEGER IDENTITY(1,1) PRIMARY KEY',
      sqlite3: 'INTEGER PRIMARY KEY AUTOINCREMENT',
      snowflake: 'INTEGER AUTOINCREMENT PRIMARY KEY',
      db2: 'INTEGER NOT NULL GENERATED BY DEFAULT AS IDENTITY(START WITH 1, INCREMENT BY 1) PRIMARY KEY',
      ibmi: 'INTEGER GENERATED BY DEFAULT AS IDENTITY (START WITH 1, INCREMENT BY 1) PRIMARY KEY',
      oracle: ' NUMBER(*,0) GENERATED BY DEFAULT ON NULL AS IDENTITY PRIMARY KEY',
    },
  );

  testSql(
    { type: 'INTEGER', autoIncrement: true, initialAutoIncrement: 5 },
    {
      default: 'INTEGER auto_increment',
      postgres: 'INTEGER SERIAL',
      mssql: 'INTEGER NULL IDENTITY(1,1)',
      sqlite3: 'INTEGER',
      snowflake: 'INTEGER AUTOINCREMENT',
      db2: 'INTEGER GENERATED BY DEFAULT AS IDENTITY(START WITH 5, INCREMENT BY 1)',
      ibmi: 'INTEGER GENERATED BY DEFAULT AS IDENTITY (START WITH 1, INCREMENT BY 1)',
      oracle: ' NUMBER(*,0) GENERATED BY DEFAULT ON NULL AS IDENTITY',
    },
  );

  testSql(
    { type: 'INTEGER', autoIncrement: true, autoIncrementIdentity: true, primaryKey: true },
    {
      default: 'INTEGER auto_increment PRIMARY KEY',
      postgres: 'INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY',
      mssql: 'INTEGER IDENTITY(1,1) PRIMARY KEY',
      sqlite3: 'INTEGER PRIMARY KEY AUTOINCREMENT',
      snowflake: 'INTEGER AUTOINCREMENT PRIMARY KEY',
      db2: 'INTEGER NOT NULL GENERATED BY DEFAULT AS IDENTITY(START WITH 1, INCREMENT BY 1) PRIMARY KEY',
      ibmi: 'INTEGER GENERATED BY DEFAULT AS IDENTITY (START WITH 1, INCREMENT BY 1) PRIMARY KEY',
      oracle: ' NUMBER(*,0) GENERATED BY DEFAULT ON NULL AS IDENTITY PRIMARY KEY',
    },
  );

  testSql(
    { type: 'INTEGER', primaryKey: true },
    {
      default: 'INTEGER PRIMARY KEY',
      db2: 'INTEGER NOT NULL PRIMARY KEY',
    },
  );

  testSql(
    { type: 'INTEGER', defaultValue: 0 },
    {
      default: 'INTEGER DEFAULT 0',
    },
  );

  testSql(
    { type: 'INTEGER', defaultValue: undefined },
    {
      default: 'INTEGER',
      'mssql oracle': 'INTEGER NULL',
    },
  );

  testSql(
    { type: 'INTEGER', defaultValue: null },
    {
      default: 'INTEGER DEFAULT NULL',
    },
  );

  testSql(
    { type: sequelize.normalizeDataType(DataTypes.STRING), defaultValue: 'abc' },
    {
      default: "VARCHAR(255) DEFAULT 'abc'",
      mssql: "NVARCHAR(255) DEFAULT N'abc'",
      sqlite3: "TEXT DEFAULT 'abc'",
      oracle: "NVARCHAR2(255) DEFAULT 'abc'",
    },
  );

  testSql(
    { type: sequelize.normalizeDataType(DataTypes.BOOLEAN), defaultValue: true },
    {
      default: 'BOOLEAN DEFAULT true',
      'mariadb mysql': 'TINYINT(1) DEFAULT true',
      mssql: 'BIT DEFAULT 1',
      sqlite3: 'INTEGER DEFAULT 1',
      ibmi: 'SMALLINT DEFAULT 1',
      oracle: new Error('quoteIdentifier received a non-string identifier: undefined'),
    },
  );

  testSql(
    { type: sequelize.normalizeDataType(DataTypes.BOOLEAN), defaultValue: false },
    {
      default: 'BOOLEAN DEFAULT false',
      'mariadb mysql': 'TINYINT(1) DEFAULT false',
      mssql: 'BIT DEFAULT 0',
      sqlite3: 'INTEGER DEFAULT 0',
      ibmi: 'SMALLINT DEFAULT 0',
      oracle: new Error('quoteIdentifier received a non-string identifier: undefined'),
    },
  );

  testSql(
    { type: sequelize.normalizeDataType(DataTypes.DATE), defaultValue: fn('NOW') },
    {
      default: 'TIMESTAMP DEFAULT NOW()',
      mariadb: 'DATETIME DEFAULT NOW()',
      mysql: 'DATETIME DEFAULT (NOW())',
      postgres: 'TIMESTAMP WITH TIME ZONE DEFAULT NOW()',
      mssql: 'DATETIMEOFFSET DEFAULT NOW()',
      sqlite3: 'TEXT DEFAULT NOW()',
      oracle: 'TIMESTAMP WITH LOCAL TIME ZONE DEFAULT NOW()',
    },
  );

  testSql(
    { type: sequelize.normalizeDataType(DataTypes.DATE), defaultValue: literal('NOW()') },
    {
      default: 'TIMESTAMP DEFAULT NOW()',
      mariadb: 'DATETIME DEFAULT NOW()',
      mysql: 'DATETIME DEFAULT (NOW())',
      postgres: 'TIMESTAMP WITH TIME ZONE DEFAULT NOW()',
      mssql: 'DATETIMEOFFSET DEFAULT NOW()',
      sqlite3: 'TEXT DEFAULT NOW()',
      oracle: 'TIMESTAMP WITH LOCAL TIME ZONE DEFAULT NOW()',
    },
  );

  testSql(
    { type: 'TEXT', defaultValue: 'abc' },
    {
      default: "TEXT DEFAULT 'abc'",
      'mariadb mysql snowflake': 'TEXT',
      mssql: "TEXT DEFAULT N'abc'",
    },
  );

  testSql(
    { type: sequelize.normalizeDataType(DataTypes.TEXT), defaultValue: 'abc' },
    {
      default: 'TEXT',
      'postgres sqlite3': "TEXT DEFAULT 'abc'",
      'db2 ibmi': "CLOB(2147483647) DEFAULT 'abc'",
      mssql: "NVARCHAR(MAX) DEFAULT N'abc'",
      oracle: "CLOB DEFAULT 'abc'",
    },
  );

  testSql(
    { type: 'BLOB', defaultValue: [] },
    {
      default: new Error('Could not guess type of value [] because it is an empty array'),
      'mariadb mysql snowflake ibmi': 'BLOB',
    },
  );

  testSql(
    { type: sequelize.normalizeDataType(DataTypes.BLOB), defaultValue: Buffer.from('abc') },
    {
      default: 'BLOB',
      postgres: "BYTEA DEFAULT '\\x616263'",
      mssql: 'VARBINARY(MAX) DEFAULT 0x616263',
      sqlite3: "BLOB DEFAULT X'616263'",
      db2: "BLOB(1M) DEFAULT BLOB('abc')",
      ibmi: 'BLOB(1M)',
      oracle: "BLOB DEFAULT '616263'",
    },
  );

  testSql(
    { type: 'GEOMETRY', defaultValue: [] },
    {
      default: new Error('Could not guess type of value [] because it is an empty array'),
      'mariadb mysql snowflake': 'GEOMETRY',
    },
  );

  testSql(
    { type: 'JSON', defaultValue: [] },
    {
      default: new Error('Could not guess type of value [] because it is an empty array'),
      'mariadb mysql snowflake': 'JSON',
    },
  );

  testSql(
    { type: 'INTEGER', unique: true },
    {
      default: 'INTEGER UNIQUE',
      mssql: 'INTEGER NULL UNIQUE',
      oracle: 'INTEGER NULL',
    },
  );

  testSql(
    { type: 'INTEGER', unique: 'my_constraint' },
    {
      default: 'INTEGER',
      'mssql oracle': 'INTEGER NULL',
    },
  );

  testSql(
    { type: 'INTEGER', after: 'Bar' },
    {
      default: 'INTEGER',
      'mariadb mysql': 'INTEGER AFTER `Bar`',
      'mssql oracle': 'INTEGER NULL',
      'snowflake ibmi': 'INTEGER AFTER "Bar"',
    },
  );

  // TODO: postgres, db2 and mssql do not escape the comment.
  testSql(
    { type: 'INTEGER', comment: 'Test' },
    {
      default: "INTEGER COMMENT 'Test'",
      'postgres db2': 'INTEGER COMMENT Test',
      'sqlite3 ibmi': 'INTEGER',
      mssql: 'INTEGER NULL COMMENT Test',
      oracle: 'INTEGER NULL',
    },
  );

  testSql(
    { type: 'INTEGER', comment: "Fo'o" },
    {
      default: "INTEGER COMMENT 'Fo\\'o'",
      'postgres db2': "INTEGER COMMENT Fo'o",
      'sqlite3 ibmi': 'INTEGER',
      mssql: "INTEGER NULL COMMENT Fo'o",
      snowflake: "INTEGER COMMENT 'Fo''o'",
      oracle: 'INTEGER NULL',
    },
  );

  testSql(
    { type: 'INTEGER', comment: 'Test' },
    {
      default: "INTEGER COMMENT 'Test'",
      'postgres db2': 'INTEGER COMMENT Test',
      'sqlite3 ibmi': 'INTEGER',
      mssql: 'INTEGER NULL COMMENT Test',
      oracle: 'INTEGER NULL',
    },
    { context: 'createTable' },
  );

  testSql(
    { type: 'INTEGER', field: 'column', comment: 'Test' },
    {
      default: "INTEGER COMMENT 'Test'",
      'sqlite3 ibmi': 'INTEGER',
      postgres: `INTEGER; COMMENT ON COLUMN "foo"."bar"."column" IS 'Test'`,
      mssql: 'INTEGER NULL COMMENT Test',
      db2: 'INTEGER COMMENT Test',
      oracle: 'INTEGER NULL',
    },
    { context: 'addColumn', tableOrModel: { tableName: 'bar', schema: 'foo' } },
  );

  testSql(
    { type: 'INTEGER', comment: 'Test' },
    {
      default: "INTEGER COMMENT 'Test'",
      'sqlite3 ibmi': 'INTEGER',
      postgres: new Error('quoteIdentifier received a non-string identifier: undefined'),
      mssql: 'INTEGER NULL COMMENT Test',
      db2: 'DATA TYPE INTEGER COMMENT Test',
      oracle: 'INTEGER NULL',
    },
    { context: 'changeColumn', tableOrModel: { tableName: 'bar', schema: 'foo' } },
  );

  testSql(
    { type: 'INTEGER', comment: 'Test' },
    {
      default: "INTEGER COMMENT 'Test'",
      'sqlite3 ibmi': 'INTEGER',
      postgres: new Error('quoteIdentifier received a non-string identifier: undefined'),
      mssql: 'INTEGER NULL COMMENT Test',
      db2: 'INTEGER COMMENT Test',
      oracle: 'INTEGER NULL',
    },
    { context: 'addColumn', tableOrModel: 'bar' },
  );

  // TODO: postgres reads options.schema, options.table and options.withoutForeignKeyConstraints
  //  without guarding against a missing options object.
  testSql(
    { type: 'INTEGER', references: { table: 'Bar' } },
    {
      default: 'INTEGER REFERENCES "Bar" ("id")',
      'mariadb mysql sqlite3': 'INTEGER REFERENCES `Bar` (`id`)',
      mssql: 'INTEGER NULL REFERENCES [Bar] ([id])',
      oracle: 'INTEGER NULL REFERENCES "Bar" ("id")',
    },
  );

  testSql(
    { type: 'INTEGER', references: { table: 'Bar', key: 'pk' } },
    {
      default: 'INTEGER REFERENCES "Bar" ("pk")',
      'mariadb mysql sqlite3': 'INTEGER REFERENCES `Bar` (`pk`)',
      mssql: 'INTEGER NULL REFERENCES [Bar] ([pk])',
      oracle: 'INTEGER NULL REFERENCES "Bar" ("pk")',
    },
  );

  testSql(
    { type: 'INTEGER', references: { table: 'Bar' }, onDelete: 'CASCADE' },
    {
      default: 'INTEGER REFERENCES "Bar" ("id") ON DELETE CASCADE',
      'mariadb mysql sqlite3': 'INTEGER REFERENCES `Bar` (`id`) ON DELETE CASCADE',
      mssql: 'INTEGER NULL REFERENCES [Bar] ([id]) ON DELETE CASCADE',
      oracle: 'INTEGER NULL REFERENCES "Bar" ("id") ON DELETE CASCADE',
    },
  );

  testSql(
    { type: 'INTEGER', references: { table: 'Bar' }, onUpdate: 'RESTRICT' },
    {
      default: 'INTEGER REFERENCES "Bar" ("id") ON UPDATE RESTRICT',
      'mariadb mysql sqlite3': 'INTEGER REFERENCES `Bar` (`id`) ON UPDATE RESTRICT',
      mssql: 'INTEGER NULL REFERENCES [Bar] ([id]) ON UPDATE RESTRICT',
      oracle: 'INTEGER NULL REFERENCES "Bar" ("id")',
    },
  );

  testSql(
    { type: 'INTEGER', references: { table: 'Bar' }, onDelete: 'CASCADE', onUpdate: 'RESTRICT' },
    {
      default: 'INTEGER REFERENCES "Bar" ("id") ON DELETE CASCADE ON UPDATE RESTRICT',
      'mariadb mysql sqlite3':
        'INTEGER REFERENCES `Bar` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT',
      mssql: 'INTEGER NULL REFERENCES [Bar] ([id]) ON DELETE CASCADE ON UPDATE RESTRICT',
      oracle: 'INTEGER NULL REFERENCES "Bar" ("id") ON DELETE CASCADE',
    },
  );

  testSql(
    { type: 'INTEGER', references: { table: 'Bar', deferrable: 'INITIALLY_IMMEDIATE' } },
    {
      default: 'INTEGER REFERENCES `Bar` (`id`)',
      'snowflake db2 ibmi': 'INTEGER REFERENCES "Bar" ("id")',
      postgres: 'INTEGER REFERENCES "Bar" ("id") DEFERRABLE INITIALLY IMMEDIATE',
      mssql: 'INTEGER NULL REFERENCES [Bar] ([id])',
      oracle: 'INTEGER NULL REFERENCES "Bar" ("id")',
    },
  );

  testSql(
    { type: 'INTEGER', references: { table: { tableName: 'Bar', schema: 'myschema' } } },
    {
      default: 'INTEGER REFERENCES "myschema"."Bar" ("id")',
      'mariadb mysql': 'INTEGER REFERENCES `myschema`.`Bar` (`id`)',
      mssql: 'INTEGER NULL REFERENCES [myschema].[Bar] ([id])',
      sqlite3: 'INTEGER REFERENCES `myschema.Bar` (`id`)',
      oracle: 'INTEGER NULL REFERENCES "myschema"."Bar" ("id")',
    },
  );

  testSql(
    { type: 'INTEGER', references: { table: 'Bar' } },
    {
      default: 'INTEGER',
      'mssql oracle': 'INTEGER NULL',
    },
    { withoutForeignKeyConstraints: true },
  );

  testSql(
    { type: 'INTEGER', field: 'myColumn', references: { table: 'Bar' } },
    {
      default:
        'INTEGER, ADD CONSTRAINT `myTable_myColumn_foreign_idx` FOREIGN KEY (`myColumn`) REFERENCES `Bar` (`id`)',
      postgres: 'INTEGER REFERENCES "Bar" ("id")',
      mssql: 'INTEGER NULL REFERENCES [Bar] ([id])',
      sqlite3: 'INTEGER REFERENCES `Bar` (`id`)',
      snowflake:
        'INTEGER, ADD CONSTRAINT "myTable_myColumn_foreign_idx" FOREIGN KEY ("myColumn") REFERENCES "Bar" ("id")',
      db2: 'INTEGER ADD CONSTRAINT "myTable_myColumn_fidx" FOREIGN KEY ("myColumn") REFERENCES "Bar" ("id")',
      ibmi: 'INTEGER ADD CONSTRAINT "myTable_myColumn_foreign_idx" FOREIGN KEY ("myColumn") REFERENCES "Bar" ("id")',
      oracle: 'INTEGER NULL REFERENCES "Bar" ("id")',
    },
    { context: 'addColumn', tableOrModel: 'myTable' },
  );

  testSql(
    { type: 'INTEGER', field: 'myColumn', references: { table: 'Bar' } },
    {
      default:
        'INTEGER, ADD CONSTRAINT `myTable_myColumn_foreign_idx` FOREIGN KEY (`myColumn`) REFERENCES `Bar` (`id`)',
      postgres: 'INTEGER REFERENCES "mySchema"."Bar" ("id")',
      mssql: 'INTEGER NULL REFERENCES [Bar] ([id])',
      sqlite3: 'INTEGER REFERENCES `Bar` (`id`)',
      snowflake:
        'INTEGER, ADD CONSTRAINT "myTable_myColumn_foreign_idx" FOREIGN KEY ("myColumn") REFERENCES "Bar" ("id")',
      db2: 'INTEGER ADD CONSTRAINT "myTable_myColumn_fidx" FOREIGN KEY ("myColumn") REFERENCES "Bar" ("id")',
      ibmi: 'INTEGER ADD CONSTRAINT "myTable_myColumn_foreign_idx" FOREIGN KEY ("myColumn") REFERENCES "Bar" ("id")',
      oracle: 'INTEGER NULL REFERENCES "Bar" ("id")',
    },
    { context: 'addColumn', tableOrModel: { tableName: 'myTable', schema: 'mySchema' } },
  );

  testSql(
    {
      type: 'INTEGER',
      allowNull: false,
      autoIncrement: true,
      defaultValue: 1,
      references: { table: 'Bar' },
      onDelete: 'CASCADE',
      onUpdate: 'RESTRICT',
    },
    {
      default:
        'INTEGER NOT NULL auto_increment DEFAULT 1 REFERENCES `Bar` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT',
      postgres:
        'INTEGER NOT NULL SERIAL DEFAULT 1 REFERENCES "Bar" ("id") ON DELETE CASCADE ON UPDATE RESTRICT',
      mssql:
        'INTEGER NOT NULL IDENTITY(1,1) DEFAULT 1 REFERENCES [Bar] ([id]) ON DELETE CASCADE ON UPDATE RESTRICT',
      sqlite3:
        'INTEGER NOT NULL DEFAULT 1 REFERENCES `Bar` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT',
      snowflake:
        'INTEGER NOT NULL AUTOINCREMENT DEFAULT 1 REFERENCES "Bar" ("id") ON DELETE CASCADE ON UPDATE RESTRICT',
      db2: 'INTEGER NOT NULL GENERATED BY DEFAULT AS IDENTITY(START WITH 1, INCREMENT BY 1) DEFAULT 1 REFERENCES "Bar" ("id") ON DELETE CASCADE ON UPDATE RESTRICT',
      ibmi: 'INTEGER NOT NULL GENERATED BY DEFAULT AS IDENTITY (START WITH 1, INCREMENT BY 1) DEFAULT 1 REFERENCES "Bar" ("id") ON DELETE CASCADE ON UPDATE RESTRICT',
      oracle:
        ' NUMBER(*,0) GENERATED BY DEFAULT ON NULL AS IDENTITY REFERENCES "Bar" ("id") ON DELETE CASCADE',
    },
  );

  testSql(
    { type: 'INTEGER' },
    {
      default: 'INTEGER',
      'mssql oracle': 'INTEGER NULL',
    },
    {},
  );

  testSql(
    { type: 'INTEGER' },
    {
      default: 'INTEGER',
      'mssql oracle': 'INTEGER NULL',
    },
    { context: 'createTable' },
  );

  testSql(
    { type: sequelize.normalizeDataType(DataTypes.BOOLEAN), field: 'foo' },
    {
      default: 'BOOLEAN',
      'mariadb mysql': 'TINYINT(1)',
      mssql: 'BIT NULL',
      sqlite3: 'INTEGER',
      ibmi: 'SMALLINT',
      oracle: `CHAR(1) CHECK ("foo" IN('1', '0'))`,
    },
  );

  testSql(
    { type: sequelize.normalizeDataType(DataTypes.INTEGER.UNSIGNED), field: 'foo' },
    {
      default: 'BIGINT',
      'mariadb mysql': 'INTEGER UNSIGNED',
      'sqlite3 snowflake': 'INTEGER',
      mssql: 'BIGINT NULL',
      oracle: 'INTEGER NULL CHECK("foo" >= 0)',
    },
  );

  testSql(
    { type: 'INTEGER', first: true },
    {
      default: 'INTEGER FIRST',
      'postgres sqlite3 db2': 'INTEGER',
      'mssql oracle': 'INTEGER NULL',
    },
  );

  testSql(
    { type: sequelize.normalizeDataType(DataTypes.ENUM('a', 'b')), field: 'foo' },
    {
      default: "ENUM('a', 'b')",
      'db2 ibmi': `VARCHAR(255) CHECK ("foo" IN('a', 'b'))`,
      mssql: "NVARCHAR(255) CHECK ([foo] IN(N'a', N'b'))",
      sqlite3: 'TEXT',
      snowflake: 'VARCHAR(255)',
      oracle: `VARCHAR2(512) CHECK ("foo" IN('a', 'b'))`,
    },
  );

  testSql(
    { type: 'INTEGER' },
    {
      default: 'INTEGER',
      'mssql oracle': 'INTEGER NULL',
      db2: 'DATA TYPE INTEGER',
    },
    { context: 'changeColumn' },
  );

  testSql(
    { type: 'INTEGER', unique: true },
    {
      default: 'INTEGER UNIQUE',
      'mssql oracle': 'INTEGER NULL',
      db2: 'DATA TYPE INTEGER',
    },
    { context: 'changeColumn' },
  );

  testSql(
    { type: 'INTEGER', allowNull: true, comment: 'Test' },
    {
      default: "INTEGER COMMENT 'Test'",
      'sqlite3 ibmi': 'INTEGER',
      postgres: new Error('quoteIdentifier received a non-string identifier: undefined'),
      mssql: 'INTEGER NULL COMMENT Test',
      db2: 'DATA TYPE INTEGER COMMENT Test',
      oracle: 'INTEGER NULL',
    },
    { context: 'changeColumn' },
  );

  if (dialectSupports.dataTypes.JSON) {
    testSql(
      { type: sequelize.normalizeDataType(DataTypes.JSON), field: 'foo' },
      {
        default: 'JSON',
        mssql: 'NVARCHAR(MAX) NULL',
        sqlite3: 'TEXT',
        oracle: 'BLOB CHECK ("foo" IS JSON)',
      },
    );
  }

  if (dialectSupports.dataTypes.ARRAY) {
    testSql(
      {
        type: sequelize.normalizeDataType(DataTypes.ARRAY(DataTypes.ENUM('value1', 'value2'))),
        field: 'foo',
      },
      {
        postgres: "ENUM('value1', 'value2')[]",
      },
    );
  }

  describe('quoteIdentifiers: false', () => {
    allowDeprecationsInSuite(['SEQUELIZE0023']);

    const testUnquotedSql = createAttributeTester(
      () => createSequelizeInstance({ quoteIdentifiers: false }).dialect.queryGenerator,
    );

    testUnquotedSql(
      { type: 'INTEGER', references: { table: 'Bar' } },
      {
        default: 'INTEGER REFERENCES `Bar` (`id`)',
        'postgres snowflake': 'INTEGER REFERENCES Bar (id)',
        'db2 ibmi': 'INTEGER REFERENCES "Bar" ("id")',
        mssql: 'INTEGER NULL REFERENCES [Bar] ([id])',
        oracle: 'INTEGER NULL REFERENCES Bar (id)',
      },
    );

    testUnquotedSql(
      { type: 'INTEGER', references: { table: 'Bar', key: 'pk' } },
      {
        default: 'INTEGER REFERENCES `Bar` (`pk`)',
        'postgres snowflake': 'INTEGER REFERENCES Bar (pk)',
        'db2 ibmi': 'INTEGER REFERENCES "Bar" ("pk")',
        mssql: 'INTEGER NULL REFERENCES [Bar] ([pk])',
        oracle: 'INTEGER NULL REFERENCES Bar (pk)',
      },
    );

    testUnquotedSql(
      { type: 'INTEGER', references: { table: 'Bar' }, onDelete: 'CASCADE' },
      {
        default: 'INTEGER REFERENCES `Bar` (`id`) ON DELETE CASCADE',
        'postgres snowflake': 'INTEGER REFERENCES Bar (id) ON DELETE CASCADE',
        'db2 ibmi': 'INTEGER REFERENCES "Bar" ("id") ON DELETE CASCADE',
        mssql: 'INTEGER NULL REFERENCES [Bar] ([id]) ON DELETE CASCADE',
        oracle: 'INTEGER NULL REFERENCES Bar (id) ON DELETE CASCADE',
      },
    );

    testUnquotedSql(
      { type: 'INTEGER', references: { table: 'Bar' }, onUpdate: 'RESTRICT' },
      {
        default: 'INTEGER REFERENCES `Bar` (`id`) ON UPDATE RESTRICT',
        'postgres snowflake': 'INTEGER REFERENCES Bar (id) ON UPDATE RESTRICT',
        'db2 ibmi': 'INTEGER REFERENCES "Bar" ("id") ON UPDATE RESTRICT',
        mssql: 'INTEGER NULL REFERENCES [Bar] ([id]) ON UPDATE RESTRICT',
        oracle: 'INTEGER NULL REFERENCES Bar (id)',
      },
    );

    testUnquotedSql(
      { type: 'INTEGER', references: { table: 'Bar' }, onDelete: 'CASCADE', onUpdate: 'RESTRICT' },
      {
        default: 'INTEGER REFERENCES `Bar` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT',
        'postgres snowflake': 'INTEGER REFERENCES Bar (id) ON DELETE CASCADE ON UPDATE RESTRICT',
        'db2 ibmi': 'INTEGER REFERENCES "Bar" ("id") ON DELETE CASCADE ON UPDATE RESTRICT',
        mssql: 'INTEGER NULL REFERENCES [Bar] ([id]) ON DELETE CASCADE ON UPDATE RESTRICT',
        oracle: 'INTEGER NULL REFERENCES Bar (id) ON DELETE CASCADE',
      },
    );

    testUnquotedSql(
      { type: 'INTEGER', references: { table: { tableName: 'Bar', schema: 'myschema' } } },
      {
        default: 'INTEGER REFERENCES `myschema`.`Bar` (`id`)',
        'postgres snowflake': 'INTEGER REFERENCES myschema.Bar (id)',
        'db2 ibmi': 'INTEGER REFERENCES "myschema"."Bar" ("id")',
        mssql: 'INTEGER NULL REFERENCES [myschema].[Bar] ([id])',
        sqlite3: 'INTEGER REFERENCES `myschema.Bar` (`id`)',
        oracle: 'INTEGER NULL REFERENCES myschema.Bar (id)',
      },
    );

    testUnquotedSql(
      { type: 'INTEGER', references: { table: 'Bar' } },
      {
        default: 'INTEGER REFERENCES `Bar` (`id`)',
        'postgres snowflake': 'INTEGER REFERENCES Bar (id)',
        'db2 ibmi': 'INTEGER REFERENCES "Bar" ("id")',
        mssql: 'INTEGER NULL REFERENCES [Bar] ([id])',
        oracle: 'INTEGER NULL REFERENCES Bar (id)',
      },
      { context: 'addColumn', tableOrModel: 'myTable' },
    );

    testUnquotedSql(
      {
        type: 'INTEGER',
        allowNull: false,
        autoIncrement: true,
        defaultValue: 1,
        references: { table: 'Bar' },
        onDelete: 'CASCADE',
        onUpdate: 'RESTRICT',
      },
      {
        default:
          'INTEGER NOT NULL auto_increment DEFAULT 1 REFERENCES `Bar` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT',
        postgres:
          'INTEGER NOT NULL SERIAL DEFAULT 1 REFERENCES Bar (id) ON DELETE CASCADE ON UPDATE RESTRICT',
        mssql:
          'INTEGER NOT NULL IDENTITY(1,1) DEFAULT 1 REFERENCES [Bar] ([id]) ON DELETE CASCADE ON UPDATE RESTRICT',
        sqlite3:
          'INTEGER NOT NULL DEFAULT 1 REFERENCES `Bar` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT',
        snowflake:
          'INTEGER NOT NULL AUTOINCREMENT DEFAULT 1 REFERENCES Bar (id) ON DELETE CASCADE ON UPDATE RESTRICT',
        db2: 'INTEGER NOT NULL GENERATED BY DEFAULT AS IDENTITY(START WITH 1, INCREMENT BY 1) DEFAULT 1 REFERENCES "Bar" ("id") ON DELETE CASCADE ON UPDATE RESTRICT',
        ibmi: 'INTEGER NOT NULL GENERATED BY DEFAULT AS IDENTITY (START WITH 1, INCREMENT BY 1) DEFAULT 1 REFERENCES "Bar" ("id") ON DELETE CASCADE ON UPDATE RESTRICT',
        oracle:
          ' NUMBER(*,0) GENERATED BY DEFAULT ON NULL AS IDENTITY REFERENCES Bar (id) ON DELETE CASCADE',
      },
    );

    testUnquotedSql(
      { type: 'INTEGER', after: 'Bar' },
      {
        default: 'INTEGER',
        'mariadb mysql': 'INTEGER AFTER `Bar`',
        'mssql oracle': 'INTEGER NULL',
        snowflake: 'INTEGER AFTER Bar',
        ibmi: 'INTEGER AFTER "Bar"',
      },
    );

    testUnquotedSql(
      { type: 'INTEGER', comment: 'Test' },
      {
        default: "INTEGER COMMENT 'Test'",
        'sqlite3 ibmi': 'INTEGER',
        postgres: new Error(`Cannot read properties of undefined (reading 'includes')`),
        mssql: 'INTEGER NULL COMMENT Test',
        db2: 'INTEGER COMMENT Test',
        oracle: 'INTEGER NULL',
      },
      { context: 'addColumn', key: 'column', table: { tableName: 'bar', schema: 'foo' } },
    );
  });
});
