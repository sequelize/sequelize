import dayjs from 'dayjs';
import { DataTypes, literal } from '@sequelize/core';
import { buildInvalidOptionReceivedError } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/check.js';
import { createSequelizeInstance, expectsql, sequelize } from '../../support';

describe('QueryGenerator#bulkInsertQuery', () => {
  const queryGenerator = sequelize.queryGenerator;

  const User = sequelize.define('User', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    firstName: DataTypes.STRING,
  }, { timestamps: false });

  it('generates a bulk insert query', async () => {
    expectsql(queryGenerator.bulkInsertQuery('myTable', [{ name: 'foo' }, { name: 'bar' }]), {
      default: `INSERT INTO [myTable] ([name]) VALUES ('foo'),('bar')`,
      mssql: `INSERT INTO [myTable] ([name]) VALUES (N'foo'),(N'bar')`,
    });
  });

  it('throws errors for multiple empty objects', async () => {
    expectsql(() => queryGenerator.bulkInsertQuery('myTable', [{}, {}]), {
      default: new Error('No columns were defined'),
    });
  });

  it('allows bulk insert of primary key 0', async () => {
    expectsql(queryGenerator.bulkInsertQuery(User, [{ id: 0 }, { id: 1 }]), {
      default: `INSERT INTO [Users] ([id]) VALUES (0),(1)`,
      mssql: `SET IDENTITY_INSERT [Users] ON;INSERT INTO [Users] ([id]) VALUES (0),(1);SET IDENTITY_INSERT [Users] OFF`,
    });
  });

  it('allow bulk insert with a mixture of null and values for primary key', () => {
    expectsql(() => queryGenerator.bulkInsertQuery(User, [{ id: 1 }, { id: null }, { id: 3, fullName: 'foo' }]), {
      default: `INSERT INTO [Users] ([id],[fullName]) VALUES (1,DEFAULT),(DEFAULT,DEFAULT),(3,'foo')`,
      mssql: new Error(`Cannot insert a mixture of null and non-null values into an autoIncrement column (id).`),
      sqlite: `INSERT INTO \`Users\` (\`id\`,\`fullName\`) VALUES (1,NULL),(NULL,NULL),(3,'foo')`,
    });
  });

  it('supports different fields and value combinations', async () => {
    expectsql(queryGenerator.bulkInsertQuery('myTable', [{ name: 'foo', status: null }, { name: 'bar', value: 42 }]), {
      default: `INSERT INTO [myTable] ([name],[status],[value]) VALUES ('foo',NULL,DEFAULT),('bar',DEFAULT,42)`,
      mssql: `INSERT INTO [myTable] ([name],[status],[value]) VALUES (N'foo',NULL,DEFAULT),(N'bar',DEFAULT,42)`,
      sqlite: 'INSERT INTO `myTable` (`name`,`status`,`value`) VALUES (\'foo\',NULL,NULL),(\'bar\',NULL,42)',
    });
  });

  it('supports inserting dates', () => {
    expectsql(queryGenerator.bulkInsertQuery('myTable', [{ name: 'foo', birthday: dayjs('2011-03-27 10:01:55 +0000', 'YYYY-MM-DD HH:mm:ss Z').toDate() }, { name: 'bar', birthday: dayjs('2012-03-27 10:01:55 +0000', 'YYYY-MM-DD HH:mm:ss Z').toDate() }]), {
      default: `INSERT INTO [myTable] ([name],[birthday]) VALUES ('foo','2011-03-27 10:01:55.000 +00:00'),('bar','2012-03-27 10:01:55.000 +00:00')`,
      mssql: `INSERT INTO [myTable] ([name],[birthday]) VALUES (N'foo',N'2011-03-27 10:01:55.000 +00:00'),(N'bar',N'2012-03-27 10:01:55.000 +00:00')`,
      'mariadb mysql': `INSERT INTO \`myTable\` (\`name\`,\`birthday\`) VALUES ('foo','2011-03-27 10:01:55.000'),('bar','2012-03-27 10:01:55.000')`,
      'db2 ibmi snowflake': `INSERT INTO "myTable" ("name","birthday") VALUES ('foo','2011-03-27 10:01:55.000'),('bar','2012-03-27 10:01:55.000')`,
    });
  });

  it('supports inserting json data', () => {
    expectsql(queryGenerator.bulkInsertQuery('myTable', [{ name: JSON.stringify({ info: 'Look ma a " quote' }) }, { name: JSON.stringify({ info: 'Look ma another " quote' }) }]), {
      default: `INSERT INTO [myTable] ([name]) VALUES ('{"info":"Look ma a \\" quote"}'),('{"info":"Look ma another \\" quote"}')`,
      mssql: `INSERT INTO [myTable] ([name]) VALUES (N'{"info":"Look ma a \\" quote"}'),(N'{"info":"Look ma another \\" quote"}')`,
      'mariadb mysql': `INSERT INTO \`myTable\` (\`name\`) VALUES ('{"info":"Look ma a \\\\" quote"}'),('{"info":"Look ma another \\\\" quote"}')`,
    });
  });

  it('escapes special characters correctly', () => {
    expectsql(queryGenerator.bulkInsertQuery('myTable', [{ name: 'foo\';DROP TABLE mySchema.myTable;' }, { name: 'bar' }]), {
      default: `INSERT INTO [myTable] ([name]) VALUES ('foo'';DROP TABLE mySchema.myTable;'),('bar')`,
      mssql: `INSERT INTO [myTable] ([name]) VALUES (N'foo'';DROP TABLE mySchema.myTable;'),(N'bar')`,
      'mariadb mysql': `INSERT INTO \`myTable\` (\`name\`) VALUES ('foo\\';DROP TABLE mySchema.myTable;'),('bar')`,
    });
  });

  it('support `ignoreDuplicates` option', () => {
    expectsql(() => queryGenerator.bulkInsertQuery('myTable', [{ name: 'foo' }, { name: 'bar' }], { ignoreDuplicates: true }), {
      default: buildInvalidOptionReceivedError('bulkInsertQuery', sequelize.dialect.name, ['ignoreDuplicates']),
      postgres: `INSERT INTO "myTable" ("name") VALUES ('foo'),('bar') ON CONFLICT DO NOTHING`,
      sqlite: 'INSERT OR IGNORE INTO `myTable` (`name`) VALUES (\'foo\'),(\'bar\')',
      'mariadb mysql': 'INSERT IGNORE INTO `myTable` (`name`) VALUES (\'foo\'),(\'bar\')',
    });
  });

  it('supports `ignoreDuplicates` option with `returning`', () => {
    expectsql(() => queryGenerator.bulkInsertQuery('myTable', [{ name: 'foo' }, { name: 'bar' }], { ignoreDuplicates: true, returning: true }), {
      default: buildInvalidOptionReceivedError('bulkInsertQuery', sequelize.dialect.name, ['ignoreDuplicates', 'returning']),
      postgres: `INSERT INTO "myTable" ("name") VALUES ('foo'),('bar') ON CONFLICT DO NOTHING RETURNING *`,
      sqlite: 'INSERT OR IGNORE INTO `myTable` (`name`) VALUES (\'foo\'),(\'bar\') RETURNING *',
      'mariadb mysql': buildInvalidOptionReceivedError('bulkInsertQuery', sequelize.dialect.name, ['returning']),
      'db2 ibmi mssql': buildInvalidOptionReceivedError('bulkInsertQuery', sequelize.dialect.name, ['ignoreDuplicates']),
    });
  });

  it('supports `updateOnDuplicate` option', () => {
    expectsql(() => queryGenerator.bulkInsertQuery('myTable', [{ name: 'foo' }, { name: 'bar' }], { updateOnDuplicate: ['name'], upsertKeys: ['id'] }), {
      default: buildInvalidOptionReceivedError('bulkInsertQuery', sequelize.dialect.name, ['updateOnDuplicate']),
      postgres: `INSERT INTO "myTable" ("name") VALUES ('foo'),('bar') ON CONFLICT ("id") DO UPDATE SET "name"=EXCLUDED."name"`,
      sqlite: 'INSERT INTO `myTable` (`name`) VALUES (\'foo\'),(\'bar\') ON CONFLICT (`id`) DO UPDATE SET `name`=EXCLUDED.`name`',
      'mariadb mysql': 'INSERT INTO `myTable` (`name`) VALUES (\'foo\'),(\'bar\') ON DUPLICATE KEY UPDATE `name`=VALUES(`name`)',
    });
  });

  it('supports `updateOnDuplicate` option with `conflictWhere`', () => {
    expectsql(() => queryGenerator.bulkInsertQuery('myTable', [{ name: 'foo' }, { name: 'bar' }], { updateOnDuplicate: ['name'], upsertKeys: ['id'], conflictWhere: { id: 1 } }), {
      default: buildInvalidOptionReceivedError('bulkInsertQuery', sequelize.dialect.name, ['updateOnDuplicate']),
      postgres: `INSERT INTO "myTable" ("name") VALUES ('foo'),('bar') ON CONFLICT ("id") WHERE "id" = 1 DO UPDATE SET "name"=EXCLUDED."name"`,
      sqlite: 'INSERT INTO `myTable` (`name`) VALUES (\'foo\'),(\'bar\') ON CONFLICT (`id`) WHERE `id` = 1 DO UPDATE SET `name`=EXCLUDED.`name`',
      'mariadb mysql': buildInvalidOptionReceivedError('bulkInsertQuery', sequelize.dialect.name, ['conflictWhere']),
    });
  });

  it('supports `updateOnDuplicate` option with `returning`', () => {
    expectsql(() => queryGenerator.bulkInsertQuery('myTable', [{ name: 'foo' }, { name: 'bar' }], { updateOnDuplicate: ['name'], returning: true, upsertKeys: ['id'] }), {
      default: buildInvalidOptionReceivedError('bulkInsertQuery', sequelize.dialect.name, ['updateOnDuplicate', 'returning']),
      postgres: `INSERT INTO "myTable" ("name") VALUES ('foo'),('bar') ON CONFLICT ("id") DO UPDATE SET "name"=EXCLUDED."name" RETURNING *`,
      sqlite: 'INSERT INTO `myTable` (`name`) VALUES (\'foo\'),(\'bar\') ON CONFLICT (`id`) DO UPDATE SET `name`=EXCLUDED.`name` RETURNING *',
      'mariadb mysql': buildInvalidOptionReceivedError('bulkInsertQuery', sequelize.dialect.name, ['returning']),
      'db2 ibmi mssql': buildInvalidOptionReceivedError('bulkInsertQuery', sequelize.dialect.name, ['updateOnDuplicate']),
    });
  });

  it('supports `updateOnDuplicate` option with `conflictWhere` and `returning`', () => {
    expectsql(() => queryGenerator.bulkInsertQuery('myTable', [{ name: 'foo' }, { name: 'bar' }], { updateOnDuplicate: ['name'], returning: true, upsertKeys: ['id'], conflictWhere: { id: 1 } }), {
      default: buildInvalidOptionReceivedError('bulkInsertQuery', sequelize.dialect.name, ['updateOnDuplicate', 'returning']),
      postgres: `INSERT INTO "myTable" ("name") VALUES ('foo'),('bar') ON CONFLICT ("id") WHERE "id" = 1 DO UPDATE SET "name"=EXCLUDED."name" RETURNING *`,
      sqlite: 'INSERT INTO `myTable` (`name`) VALUES (\'foo\'),(\'bar\') ON CONFLICT (`id`) WHERE `id` = 1 DO UPDATE SET `name`=EXCLUDED.`name` RETURNING *',
      'mariadb mysql': buildInvalidOptionReceivedError('bulkInsertQuery', sequelize.dialect.name, ['returning', 'conflictWhere']),
      'db2 ibmi mssql': buildInvalidOptionReceivedError('bulkInsertQuery', sequelize.dialect.name, ['updateOnDuplicate']),
    });
  });

  it('throws error for `updateOnDuplicate` option with `ignoreDuplicates`', () => {
    expectsql(() => queryGenerator.bulkInsertQuery('myTable', [{ name: 'foo' }, { name: 'bar' }], { ignoreDuplicates: true, updateOnDuplicate: ['name'], upsertKeys: ['id'] }), ({
      default: buildInvalidOptionReceivedError('bulkInsertQuery', sequelize.dialect.name, ['ignoreDuplicates', 'updateOnDuplicate']),
      'mariadb mysql postgres sqlite': new Error('Options ignoreDuplicates and updateOnDuplicate cannot be used together'),
    }));
  });

  it('supports all options together', () => {
    expectsql(() => queryGenerator.bulkInsertQuery('myTable', [{ name: 'foo' }, { name: 'bar' }], { ignoreDuplicates: true, updateOnDuplicate: ['name'], returning: true, upsertKeys: ['id'], conflictWhere: { id: 1 } }), {
      default: buildInvalidOptionReceivedError('bulkInsertQuery', sequelize.dialect.name, ['ignoreDuplicates', 'updateOnDuplicate', 'returning']),
      'mariadb mysql': buildInvalidOptionReceivedError('bulkInsertQuery', sequelize.dialect.name, ['returning']),
      'db2 ibmi mssql': buildInvalidOptionReceivedError('bulkInsertQuery', sequelize.dialect.name, ['ignoreDuplicates', 'updateOnDuplicate']),
      'postgres sqlite': new Error('Options ignoreDuplicates and updateOnDuplicate cannot be used together'),
    });
  });

  it('generates an insert query for a model', () => {
    expectsql(queryGenerator.bulkInsertQuery(User, [{ firstName: 'John' }, { firstName: 'Jane' }]), {
      default: `INSERT INTO [Users] ([firstName]) VALUES ('John'),('Jane')`,
      mssql: `INSERT INTO [Users] ([firstName]) VALUES (N'John'),(N'Jane')`,
    });
  });

  it('generates an insert query for a table and schema', () => {
    expectsql(queryGenerator.bulkInsertQuery({ tableName: 'myTable', schema: 'mySchema' }, [{ name: 'foo' }, { name: 'bar' }]), {
      default: `INSERT INTO [mySchema].[myTable] ([name]) VALUES ('foo'),('bar')`,
      mssql: `INSERT INTO [mySchema].[myTable] ([name]) VALUES (N'foo'),(N'bar')`,
      sqlite: 'INSERT INTO `mySchema.myTable` (`name`) VALUES (\'foo\'),(\'bar\')',
    });
  });

  it('generates an insert query for a table and default schema', () => {
    expectsql(queryGenerator.bulkInsertQuery({ tableName: 'myTable', schema: sequelize.dialect.getDefaultSchema() }, [{ name: 'foo' }, { name: 'bar' }]), {
      default: `INSERT INTO [myTable] ([name]) VALUES ('foo'),('bar')`,
      mssql: `INSERT INTO [myTable] ([name]) VALUES (N'foo'),(N'bar')`,
    });
  });

  it('generates an insert query for a table and globally set schema', () => {
    const sequelizeSchema = createSequelizeInstance({ schema: 'mySchema' });
    const queryGeneratorSchema = sequelizeSchema.queryGenerator;

    expectsql(queryGeneratorSchema.bulkInsertQuery('myTable', [{ name: 'foo' }, { name: 'bar' }]), {
      default: `INSERT INTO [mySchema].[myTable] ([name]) VALUES ('foo'),('bar')`,
      mssql: `INSERT INTO [mySchema].[myTable] ([name]) VALUES (N'foo'),(N'bar')`,
      sqlite: 'INSERT INTO `mySchema.myTable` (`name`) VALUES (\'foo\'),(\'bar\')',
    });
  });

  it('generates an insert query for a table and schema with custom delimiter argument', () => {
    // This test is only relevant for dialects that do not support schemas
    if (sequelize.dialect.supports.schemas) {
      return;
    }

    expectsql(() => queryGenerator.bulkInsertQuery({ tableName: 'myTable', schema: 'mySchema', delimiter: 'custom' }, [{ name: 'foo' }, { name: 'bar' }]), {
      sqlite: 'INSERT INTO `mySchemacustommyTable` (`name`) VALUES (\'foo\'),(\'bar\')',
    });
  });

  describe('ignoreNull', () => {
    it('retains null values by default', () => {
      expectsql(queryGenerator.bulkInsertQuery('myTable', [{ name: 'foo', nullValue: null }, { name: 'bar', nullValue: null }]), {
        default: `INSERT INTO [myTable] ([name],[nullValue]) VALUES ('foo',NULL),('bar',NULL)`,
        mssql: `INSERT INTO [myTable] ([name],[nullValue]) VALUES (N'foo',NULL),(N'bar',NULL)`,
      });
    });

    it('uses default for undefined properties if supported', () => {
      expectsql(queryGenerator.bulkInsertQuery('myTable', [{ name: 'foo', nullValue: undefined }, { name: 'bar', nullValue: undefined }]), {
        default: `INSERT INTO [myTable] ([name],[nullValue]) VALUES ('foo',DEFAULT),('bar',DEFAULT)`,
        mssql: `INSERT INTO [myTable] ([name],[nullValue]) VALUES (N'foo',DEFAULT),(N'bar',DEFAULT)`,
        sqlite: 'INSERT INTO `myTable` (`name`,`nullValue`) VALUES (\'foo\',NULL),(\'bar\',NULL)',
      });
    });

    const customSequelize = createSequelizeInstance({ omitNull: true });
    it('omits null values when true', () => {
      expectsql(() => customSequelize.queryGenerator.bulkInsertQuery('myTable', [{ name: 'foo', nullValue: null }, { name: 'bar', nullValue: null }]), {
        default: `INSERT INTO [myTable] ([name]) VALUES ('foo'),('bar')`,
        mssql: `INSERT INTO [myTable] ([name]) VALUES (N'foo'),(N'bar')`,
      });
    });

    it('omits undefined values when true', () => {
      expectsql(() => customSequelize.queryGenerator.bulkInsertQuery('myTable', [{ name: 'foo', nullValue: undefined }, { name: 'bar', nullValue: undefined }]), {
        default: `INSERT INTO [myTable] ([name]) VALUES ('foo'),('bar')`,
        mssql: `INSERT INTO [myTable] ([name]) VALUES (N'foo'),(N'bar')`,
      });
    });
  });

  describe('returning', () => {
    it('supports returning: true', () => {
      expectsql(() => queryGenerator.bulkInsertQuery('myTable', [{ name: 'foo' }, { name: 'bar' }], { returning: true }), {
        default: buildInvalidOptionReceivedError('bulkInsertQuery', sequelize.dialect.name, ['returning']),
        mssql: new Error('Cannot use "returning" option with no attributes'),
        postgres: `INSERT INTO "myTable" ("name") VALUES ('foo'),('bar') RETURNING *`,
        sqlite: 'INSERT INTO `myTable` (`name`) VALUES (\'foo\'),(\'bar\') RETURNING *',
        'db2 ibmi': `SELECT * FROM FINAL TABLE (INSERT INTO "myTable" ("name") VALUES ('foo'),('bar'))`,
      });
    });

    it('supports returning: true with attributes', () => {
      expectsql(() => queryGenerator.bulkInsertQuery('myTable', [{ name: 'foo' }, { name: 'bar' }], { returning: true }, { name: { type: DataTypes.STRING() } }), {
        default: buildInvalidOptionReceivedError('bulkInsertQuery', sequelize.dialect.name, ['returning']),
        mssql: `DECLARE @output_table TABLE ([name] NVARCHAR(255));INSERT INTO [myTable] ([name])
        OUTPUT INSERTED.[name] INTO @output_table VALUES (N'foo'),(N'bar');SELECT * FROM @output_table`,
        postgres: `INSERT INTO "myTable" ("name") VALUES ('foo'),('bar') RETURNING "name"`,
        sqlite: 'INSERT INTO `myTable` (`name`) VALUES (\'foo\'),(\'bar\') RETURNING `name`',
        'db2 ibmi': `SELECT "name" FROM FINAL TABLE (INSERT INTO "myTable" ("name") VALUES ('foo'),('bar'))`,
      });
    });

    it('supports returning: true with a model', () => {
      expectsql(() => queryGenerator.bulkInsertQuery(User, [{ firstName: 'John' }, { firstName: 'Jane' }], { returning: true }), {
        default: buildInvalidOptionReceivedError('bulkInsertQuery', sequelize.dialect.name, ['returning']),
        mssql: `DECLARE @output_table TABLE ([id] INTEGER, [firstName] NVARCHAR(255));INSERT INTO [Users] ([firstName])
        OUTPUT INSERTED.[id], INSERTED.[firstName] INTO @output_table VALUES (N'John'),(N'Jane');SELECT * FROM @output_table`,
        postgres: `INSERT INTO "Users" ("firstName") VALUES ('John'),('Jane') RETURNING "id", "firstName"`,
        sqlite: 'INSERT INTO `Users` (`firstName`) VALUES (\'John\'),(\'Jane\') RETURNING `id`, `firstName`',
        'db2 ibmi': `SELECT "id", "firstName" FROM FINAL TABLE (INSERT INTO "Users" ("firstName") VALUES ('John'),('Jane'))`,
      });
    });

    it('supports array of strings (column names)', () => {
      expectsql(() => queryGenerator.bulkInsertQuery('myTable', [{ name: 'foo' }, { name: 'bar' }], { returning: ['*', 'myColumn'] }), {
        default: buildInvalidOptionReceivedError('bulkInsertQuery', sequelize.dialect.name, ['returning']),
        mssql: new Error('Cannot use "returning" option with no attributes'),
        postgres: `INSERT INTO "myTable" ("name") VALUES ('foo'),('bar') RETURNING "*", "myColumn"`,
        sqlite: 'INSERT INTO `myTable` (`name`) VALUES (\'foo\'),(\'bar\') RETURNING `*`, `myColumn`',
        'db2 ibmi': `SELECT "*", "myColumn" FROM FINAL TABLE (INSERT INTO "myTable" ("name") VALUES ('foo'),('bar'))`,
      });
    });

    it('supports array of strings (column names) with attributes', () => {
      expectsql(() => queryGenerator.bulkInsertQuery('myTable', [{ name: 'foo' }, { name: 'bar' }], { returning: ['*', 'myColumn'] }, { name: { type: DataTypes.STRING() } }), {
        default: buildInvalidOptionReceivedError('bulkInsertQuery', sequelize.dialect.name, ['returning']),
        mssql: `DECLARE @output_table TABLE ([*] NVARCHAR(MAX), [myColumn] NVARCHAR(MAX));INSERT INTO [myTable] ([name])
        OUTPUT INSERTED.[*], INSERTED.[myColumn] INTO @output_table VALUES (N'foo'),(N'bar');SELECT * FROM @output_table`,
        postgres: `INSERT INTO "myTable" ("name") VALUES ('foo'),('bar') RETURNING "*", "myColumn"`,
        sqlite: 'INSERT INTO `myTable` (`name`) VALUES (\'foo\'),(\'bar\') RETURNING `*`, `myColumn`',
        'db2 ibmi': `SELECT "*", "myColumn" FROM FINAL TABLE (INSERT INTO "myTable" ("name") VALUES ('foo'),('bar'))`,
      });
    });

    it('supports array of strings (column names) with a model', () => {
      expectsql(() => queryGenerator.bulkInsertQuery(User, [{ firstName: 'John' }, { firstName: 'Jane' }], { returning: ['*', 'myColumn'] }), {
        default: buildInvalidOptionReceivedError('bulkInsertQuery', sequelize.dialect.name, ['returning']),
        mssql: `DECLARE @output_table TABLE ([*] NVARCHAR(MAX), [myColumn] NVARCHAR(MAX));INSERT INTO [Users] ([firstName])
        OUTPUT INSERTED.[*], INSERTED.[myColumn] INTO @output_table VALUES (N'John'),(N'Jane');SELECT * FROM @output_table`,
        postgres: `INSERT INTO "Users" ("firstName") VALUES ('John'),('Jane') RETURNING "*", "myColumn"`,
        sqlite: 'INSERT INTO `Users` (`firstName`) VALUES (\'John\'),(\'Jane\') RETURNING `*`, `myColumn`',
        'db2 ibmi': `SELECT "*", "myColumn" FROM FINAL TABLE (INSERT INTO "Users" ("firstName") VALUES ('John'),('Jane'))`,
      });
    });

    it('supports array of literals', () => {
      expectsql(() => queryGenerator.bulkInsertQuery('myTable', [{ name: 'foo' }, { name: 'bar' }], { returning: [literal('*')] }), {
        default: buildInvalidOptionReceivedError('bulkInsertQuery', sequelize.dialect.name, ['returning']),
        mssql: new Error('Cannot use "returning" option with no attributes'),
        postgres: `INSERT INTO "myTable" ("name") VALUES ('foo'),('bar') RETURNING *`,
        sqlite: 'INSERT INTO `myTable` (`name`) VALUES (\'foo\'),(\'bar\') RETURNING *',
        'db2 ibmi': `SELECT * FROM FINAL TABLE (INSERT INTO "myTable" ("name") VALUES ('foo'),('bar'))`,
      });
    });

    it('supports array of literals with attributes', () => {
      expectsql(() => queryGenerator.bulkInsertQuery('myTable', [{ name: 'foo' }, { name: 'bar' }], { returning: [literal('*')] }, { name: { type: DataTypes.STRING() } }), {
        default: buildInvalidOptionReceivedError('bulkInsertQuery', sequelize.dialect.name, ['returning']),
        mssql: new Error('literal() cannot be used in the "returning" option array in mssql. Use col(), or a string instead.'),
        postgres: `INSERT INTO "myTable" ("name") VALUES ('foo'),('bar') RETURNING *`,
        sqlite: 'INSERT INTO `myTable` (`name`) VALUES (\'foo\'),(\'bar\') RETURNING *',
        'db2 ibmi': `SELECT * FROM FINAL TABLE (INSERT INTO "myTable" ("name") VALUES ('foo'),('bar'))`,
      });
    });

    it('supports array of literals with a model', () => {
      expectsql(() => queryGenerator.bulkInsertQuery(User, [{ firstName: 'John' }, { firstName: 'Jane' }], { returning: [literal('*')] }), {
        default: buildInvalidOptionReceivedError('bulkInsertQuery', sequelize.dialect.name, ['returning']),
        mssql: new Error('literal() cannot be used in the "returning" option array in mssql. Use col(), or a string instead.'),
        postgres: `INSERT INTO "Users" ("firstName") VALUES ('John'),('Jane') RETURNING *`,
        sqlite: 'INSERT INTO `Users` (`firstName`) VALUES (\'John\'),(\'Jane\') RETURNING *',
        'db2 ibmi': `SELECT * FROM FINAL TABLE (INSERT INTO "Users" ("firstName") VALUES ('John'),('Jane'))`,
      });
    });

    it('uses temporary table for `returning` option with `hasTrigger`', () => {
      expectsql(() => queryGenerator.bulkInsertQuery('myTable', [{ name: 'foo' }, { name: 'bar' }], { returning: true, hasTrigger: true }), {
        default: buildInvalidOptionReceivedError('bulkInsertQuery', sequelize.dialect.name, ['returning']),
        mssql: new Error('Cannot use "returning" option with no attributes'),
        postgres: `INSERT INTO "myTable" ("name") VALUES ('foo'),('bar') RETURNING *`,
        sqlite: 'INSERT INTO `myTable` (`name`) VALUES (\'foo\'),(\'bar\') RETURNING *',
        'db2 ibmi': `SELECT * FROM FINAL TABLE (INSERT INTO "myTable" ("name") VALUES ('foo'),('bar'))`,
      });
    });

    it('uses temporary table for `returning` option with `hasTrigger` with attributes', () => {
      expectsql(() => queryGenerator.bulkInsertQuery('myTable', [{ name: 'foo' }, { name: 'bar' }], { returning: true, hasTrigger: true }, { name: { type: DataTypes.STRING() } }), {
        default: buildInvalidOptionReceivedError('bulkInsertQuery', sequelize.dialect.name, ['returning']),
        mssql: `DECLARE @output_table TABLE ([name] NVARCHAR(255));INSERT INTO [myTable] ([name])
        OUTPUT INSERTED.[name] INTO @output_table VALUES (N'foo'),(N'bar');SELECT * FROM @output_table`,
        postgres: `INSERT INTO "myTable" ("name") VALUES ('foo'),('bar') RETURNING "name"`,
        sqlite: 'INSERT INTO `myTable` (`name`) VALUES (\'foo\'),(\'bar\') RETURNING `name`',
        'db2 ibmi': `SELECT "name" FROM FINAL TABLE (INSERT INTO "myTable" ("name") VALUES ('foo'),('bar'))`,
      });
    });

    it('uses temporary table for `returning` option with `hasTrigger` with a model', () => {
      expectsql(() => queryGenerator.bulkInsertQuery(User, [{ firstName: 'John' }, { firstName: 'Jane' }], { returning: true, hasTrigger: true }), {
        default: buildInvalidOptionReceivedError('bulkInsertQuery', sequelize.dialect.name, ['returning']),
        mssql: `DECLARE @output_table TABLE ([id] INTEGER, [firstName] NVARCHAR(255));INSERT INTO [Users] ([firstName])
        OUTPUT INSERTED.[id], INSERTED.[firstName] INTO @output_table VALUES (N'John'),(N'Jane');SELECT * FROM @output_table`,
        postgres: `INSERT INTO "Users" ("firstName") VALUES ('John'),('Jane') RETURNING "id", "firstName"`,
        sqlite: 'INSERT INTO `Users` (`firstName`) VALUES (\'John\'),(\'Jane\') RETURNING `id`, `firstName`',
        'db2 ibmi': `SELECT "id", "firstName" FROM FINAL TABLE (INSERT INTO "Users" ("firstName") VALUES ('John'),('Jane'))`,
      });
    });
  });

  it('parses named replacements in literals', async () => {
    const sql = queryGenerator.bulkInsertQuery(User, [{
      firstName: literal(':injection'),
    }], {
      replacements: {
        injection: 'a string',
      },
    });

    expectsql(sql, {
      default: `INSERT INTO [Users] ([firstName]) VALUES ('a string')`,
      mssql: `INSERT INTO [Users] ([firstName]) VALUES (N'a string')`,
    });
  });
});
