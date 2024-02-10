import crypto from 'node:crypto';
import { expect } from 'chai';
import { stub } from 'sinon';
import { DataTypes, fn, literal } from '@sequelize/core';
import { buildInvalidOptionReceivedError } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/check.js';
import { createSequelizeInstance, expectsql, sequelize } from '../../support';

describe('QueryGenerator#insertQuery', () => {
  const queryGenerator = sequelize.queryGenerator;

  const User = sequelize.define('User', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    firstName: DataTypes.STRING,
    date: DataTypes.DATE(3),
  }, { timestamps: false });

  it('generates an insert query for a table', () => {
    expectsql(queryGenerator.insertQuery('myTable', { firstName: 'John' }), {
      bind: { default: { sequelize_1: 'John' } },
      query: {
        default: 'INSERT INTO [myTable] ([firstName]) VALUES ($sequelize_1)',
      },
    });
  });

  it('supports empty objects', () => {
    expectsql(queryGenerator.insertQuery('myTable', {}), {
      bind: {},
      query: {
        default: 'INSERT INTO [myTable] DEFAULT VALUES',
        'db2 snowflake': 'INSERT INTO "myTable" VALUES ()',
        'mariadb mysql': 'INSERT INTO `myTable` VALUES ()',
      },
    });
  });

  it('allows inserting primary key 0', () => {
    expectsql(queryGenerator.insertQuery(User, { id: 0 }), {
      bind: { default: { sequelize_1: 0 } },
      query: {
        default: 'INSERT INTO [Users] ([id]) VALUES ($sequelize_1)',
        mssql: 'SET IDENTITY_INSERT [Users] ON;INSERT INTO [Users] ([id]) VALUES ($sequelize_1);SET IDENTITY_INSERT [Users] OFF',
      },
    });
  });

  it('formats null characters correctly when inserting', () => {
    expectsql(queryGenerator.insertQuery(User, { firstName: 'null\0test' }), {
      query: {
        default: 'INSERT INTO [Users] ([firstName]) VALUES ($sequelize_1)',
      },
      bind: {
        postgres: { sequelize_1: 'null\u0000test' },
        default: { sequelize_1: 'null\0test' },
      },
    });
  });

  it('formats the date correctly when inserting', () => {
    expectsql(queryGenerator.insertQuery(User, { date: new Date(Date.UTC(2015, 0, 20)) }), {
      query: {
        default: 'INSERT INTO [Users] ([date]) VALUES ($sequelize_1)',
      },
      bind: {
        db2: { sequelize_1: '2015-01-20 00:00:00.000' },
        ibmi: { sequelize_1: '2015-01-20 00:00:00.000' },
        mariadb: { sequelize_1: '2015-01-20 00:00:00.000' },
        mssql: { sequelize_1: '2015-01-20 00:00:00.000 +00:00' },
        mysql: { sequelize_1: '2015-01-20 00:00:00.000' },
        postgres: { sequelize_1: '2015-01-20 00:00:00.000 +00:00' },
        snowflake: { sequelize_1: '2015-01-20 00:00:00.000' },
        sqlite: { sequelize_1: '2015-01-20 00:00:00.000 +00:00' },
      },
    });
  });

  it('formats date correctly when sub-second precision is explicitly specified', () => {
    expectsql(queryGenerator.insertQuery(User, { date: new Date(Date.UTC(2015, 0, 20, 1, 2, 3, 89)) }), {
      query: {
        default: 'INSERT INTO [Users] ([date]) VALUES ($sequelize_1)',
      },
      bind: {
        db2: { sequelize_1: '2015-01-20 01:02:03.089' },
        ibmi: { sequelize_1: '2015-01-20 01:02:03.089' },
        mariadb: { sequelize_1: '2015-01-20 01:02:03.089' },
        mssql: { sequelize_1: '2015-01-20 01:02:03.089 +00:00' },
        mysql: { sequelize_1: '2015-01-20 01:02:03.089' },
        postgres: { sequelize_1: '2015-01-20 01:02:03.089 +00:00' },
        snowflake: { sequelize_1: '2015-01-20 01:02:03.089' },
        sqlite: { sequelize_1: '2015-01-20 01:02:03.089 +00:00' },
      },
    });
  });

  if (sequelize.dialect.supports.globalTimeZoneConfig) {
    it('formats the date correctly when inserting with global timezone option', () => {
      const timezoneSequelize = createSequelizeInstance({ timezone: 'CET' });
      const Timezone = timezoneSequelize.define('Timezone', {
        date: DataTypes.DATE(3),
      }, { timestamps: false });

      expectsql(timezoneSequelize.queryGenerator.insertQuery(Timezone, { date: new Date(Date.UTC(2015, 0, 20)) }), {
        query: {
          default: 'INSERT INTO [Timezones] ([date]) VALUES ($sequelize_1)',
        },
        bind: {
          // these dialects change the DB-side timezone, and the input doesn't specify the timezone offset, so we have to offset the value ourselves
          // because it will be interpreted as CET by the dialect.
          mysql: { sequelize_1: '2015-01-20 01:00:00.000' },
          mariadb: { sequelize_1: '2015-01-20 01:00:00.000' },
          snowflake: { sequelize_1: '2015-01-20 01:00:00.000' },
          // These dialects do specify the offset, so they can use whichever offset they want.
          postgres: { sequelize_1: '2015-01-20 01:00:00.000 +01:00' },
        },
      });
    });
  }

  it('supports function calls for values', () => {
    expectsql(queryGenerator.insertQuery('myTable', { firstName: fn('NOW') }), {
      bind: {},
      query: {
        default: 'INSERT INTO [myTable] ([firstName]) VALUES (NOW())',
      },
    });
  });

  it('supports inserting json data', () => {
    expectsql(queryGenerator.insertQuery('myTable', { data: JSON.stringify({ info: 'Look ma a " quote' }) }), {
      bind: { default: { sequelize_1: '{"info":"Look ma a \\" quote"}' } },
      query: {
        default: 'INSERT INTO [myTable] ([data]) VALUES ($sequelize_1)',
      },
    });
  });

  it('escapes special characters correctly', () => {
    expectsql(queryGenerator.insertQuery('myTable', { firstName: `';DROP TABLE IF EXISTS myTable;` }), {
      bind: { default: { sequelize_1: `';DROP TABLE IF EXISTS myTable;` } },
      query: {
        default: 'INSERT INTO [myTable] ([firstName]) VALUES ($sequelize_1)',
      },
    });
  });

  it('support `exception` option', () => {
    // @ts-expect-error -- not using the callback
    stub(crypto, 'randomBytes').returns(Buffer.from('6c7038c20c838347', 'hex'));
    expectsql(() => queryGenerator.insertQuery('myTable', { firstName: 'John' }, { exception: true }).query, {
      default: buildInvalidOptionReceivedError('insertQuery', sequelize.dialect.name, ['exception']),
      postgres: `CREATE OR REPLACE FUNCTION pg_temp.testfunc(OUT response "myTable", OUT sequelize_caught_exception text) RETURNS RECORD AS $func_6c7038c20c838347$
      BEGIN INSERT INTO "myTable" ("firstName") VALUES ('John') RETURNING * INTO response;
      EXCEPTION WHEN unique_violation THEN GET STACKED DIAGNOSTICS sequelize_caught_exception = PG_EXCEPTION_DETAIL; END;
      $func_6c7038c20c838347$ LANGUAGE plpgsql;
      SELECT (testfunc.response).*, testfunc.sequelize_caught_exception FROM pg_temp.testfunc();
      DROP FUNCTION IF EXISTS pg_temp.testfunc()`,
    });
  });

  it('support `ignoreDuplicates` option', () => {
    expectsql(() => queryGenerator.insertQuery('myTable', { firstName: 'John' }, { ignoreDuplicates: true }).query, {
      default: buildInvalidOptionReceivedError('insertQuery', sequelize.dialect.name, ['ignoreDuplicates']),
      postgres: 'INSERT INTO "myTable" ("firstName") VALUES ($sequelize_1) ON CONFLICT DO NOTHING',
      sqlite: 'INSERT OR IGNORE INTO `myTable` (`firstName`) VALUES ($sequelize_1)',
      'mariadb mysql': 'INSERT IGNORE INTO `myTable` (`firstName`) VALUES ($sequelize_1)',
    });
  });

  it('supports `ignoreDuplicates` option with `returning`', () => {
    expectsql(() => queryGenerator.insertQuery('myTable', { firstName: 'John' }, { ignoreDuplicates: true, returning: true }).query, {
      default: buildInvalidOptionReceivedError('insertQuery', sequelize.dialect.name, ['ignoreDuplicates', 'returning']),
      postgres: 'INSERT INTO "myTable" ("firstName") VALUES ($sequelize_1) ON CONFLICT DO NOTHING RETURNING *',
      sqlite: 'INSERT OR IGNORE INTO `myTable` (`firstName`) VALUES ($sequelize_1) RETURNING *',
      'mariadb mysql': buildInvalidOptionReceivedError('insertQuery', sequelize.dialect.name, ['returning']),
      'db2 ibmi mssql': buildInvalidOptionReceivedError('insertQuery', sequelize.dialect.name, ['ignoreDuplicates']),
    });
  });

  it('supports `updateOnDuplicate` option', () => {
    expectsql(() => queryGenerator.insertQuery('myTable', { firstName: 'John' }, { updateOnDuplicate: ['firstName'], upsertKeys: ['id'] }).query, {
      default: buildInvalidOptionReceivedError('insertQuery', sequelize.dialect.name, ['updateOnDuplicate']),
      postgres: 'INSERT INTO "myTable" ("firstName") VALUES ($sequelize_1) ON CONFLICT ("id") DO UPDATE SET "firstName"=EXCLUDED."firstName"',
      sqlite: 'INSERT INTO `myTable` (`firstName`) VALUES ($sequelize_1) ON CONFLICT (`id`) DO UPDATE SET `firstName`=EXCLUDED.`firstName`',
      'mariadb mysql': 'INSERT INTO `myTable` (`firstName`) VALUES ($sequelize_1) ON DUPLICATE KEY UPDATE `firstName`=$sequelize_1',
    });
  });

  it('supports `updateOnDuplicate` option with `conflictWhere`', () => {
    expectsql(() => queryGenerator.insertQuery('myTable', { firstName: 'John' }, { updateOnDuplicate: ['firstName'], upsertKeys: ['id'], conflictWhere: { id: 1 } }).query, {
      default: buildInvalidOptionReceivedError('insertQuery', sequelize.dialect.name, ['updateOnDuplicate']),
      postgres: 'INSERT INTO "myTable" ("firstName") VALUES ($sequelize_1) ON CONFLICT ("id") WHERE "id" = $sequelize_2 DO UPDATE SET "firstName"=EXCLUDED."firstName"',
      sqlite: 'INSERT INTO `myTable` (`firstName`) VALUES ($sequelize_1) ON CONFLICT (`id`) WHERE `id` = $sequelize_2 DO UPDATE SET `firstName`=EXCLUDED.`firstName`',
      'mariadb mysql': buildInvalidOptionReceivedError('insertQuery', sequelize.dialect.name, ['conflictWhere']),
    });
  });

  it('supports `updateOnDuplicate` option with `returning`', () => {
    expectsql(() => queryGenerator.insertQuery('myTable', { firstName: 'John' }, { updateOnDuplicate: ['firstName'], returning: true, upsertKeys: ['id'] }).query, {
      default: buildInvalidOptionReceivedError('insertQuery', sequelize.dialect.name, ['updateOnDuplicate', 'returning']),
      postgres: 'INSERT INTO "myTable" ("firstName") VALUES ($sequelize_1) ON CONFLICT ("id") DO UPDATE SET "firstName"=EXCLUDED."firstName" RETURNING *',
      sqlite: 'INSERT INTO `myTable` (`firstName`) VALUES ($sequelize_1) ON CONFLICT (`id`) DO UPDATE SET `firstName`=EXCLUDED.`firstName` RETURNING *',
      'mariadb mysql': buildInvalidOptionReceivedError('insertQuery', sequelize.dialect.name, ['returning']),
      'db2 ibmi mssql': buildInvalidOptionReceivedError('insertQuery', sequelize.dialect.name, ['updateOnDuplicate']),
    });
  });

  it('supports `updateOnDuplicate` option with `conflictWhere` and `returning`', () => {
    expectsql(() => queryGenerator.insertQuery('myTable', { firstName: 'John' }, { updateOnDuplicate: ['firstName'], returning: true, upsertKeys: ['id'], conflictWhere: { id: 1 } }).query, {
      default: buildInvalidOptionReceivedError('insertQuery', sequelize.dialect.name, ['updateOnDuplicate', 'returning']),
      postgres: 'INSERT INTO "myTable" ("firstName") VALUES ($sequelize_1) ON CONFLICT ("id") WHERE "id" = $sequelize_2 DO UPDATE SET "firstName"=EXCLUDED."firstName" RETURNING *',
      sqlite: 'INSERT INTO `myTable` (`firstName`) VALUES ($sequelize_1) ON CONFLICT (`id`) WHERE `id` = $sequelize_2 DO UPDATE SET `firstName`=EXCLUDED.`firstName` RETURNING *',
      'mariadb mysql': buildInvalidOptionReceivedError('insertQuery', sequelize.dialect.name, ['returning', 'conflictWhere']),
      'db2 ibmi mssql': buildInvalidOptionReceivedError('insertQuery', sequelize.dialect.name, ['updateOnDuplicate']),
    });
  });

  it('throws error for `updateOnDuplicate` option with `ignoreDuplicates`', () => {
    expectsql(() => queryGenerator.insertQuery('myTable', { firstName: 'John' }, { ignoreDuplicates: true, updateOnDuplicate: ['firstName'], upsertKeys: ['id'] }).query, ({
      default: buildInvalidOptionReceivedError('insertQuery', sequelize.dialect.name, ['ignoreDuplicates', 'updateOnDuplicate']),
      'mariadb mysql postgres sqlite': new Error('Options ignoreDuplicates and updateOnDuplicate cannot be used together'),
    }));
  });

  it('supports all options together', () => {
    expectsql(() => queryGenerator.insertQuery('myTable', { firstName: 'John' }, { ignoreDuplicates: true, updateOnDuplicate: ['firstName'], returning: true, upsertKeys: ['id'], conflictWhere: { id: 1 } }).query, {
      default: buildInvalidOptionReceivedError('insertQuery', sequelize.dialect.name, ['ignoreDuplicates', 'updateOnDuplicate', 'returning']),
      'mariadb mysql': buildInvalidOptionReceivedError('insertQuery', sequelize.dialect.name, ['returning']),
      'db2 ibmi mssql': buildInvalidOptionReceivedError('insertQuery', sequelize.dialect.name, ['ignoreDuplicates', 'updateOnDuplicate']),
      'postgres sqlite': new Error('Options ignoreDuplicates and updateOnDuplicate cannot be used together'),
    });
  });

  it('generates an insert query for a model', () => {
    expectsql(queryGenerator.insertQuery(User, { firstName: 'John' }), {
      bind: { default: { sequelize_1: 'John' } },
      query: {
        default: 'INSERT INTO [Users] ([firstName]) VALUES ($sequelize_1)',
      },
    });
  });

  it('generates an insert query for a table and schema', () => {
    expectsql(queryGenerator.insertQuery({ tableName: 'myTable', schema: 'mySchema' }, { firstName: 'John' }), {
      bind: { default: { sequelize_1: 'John' } },
      query: {
        default: 'INSERT INTO [mySchema].[myTable] ([firstName]) VALUES ($sequelize_1)',
        sqlite: 'INSERT INTO `mySchema.myTable` (`firstName`) VALUES ($sequelize_1)',
      },
    });
  });

  it('generates an insert query for a table and default schema', () => {
    expectsql(queryGenerator.insertQuery({ tableName: 'myTable', schema: sequelize.dialect.getDefaultSchema() }, { firstName: 'John' }), {
      bind: { default: { sequelize_1: 'John' } },
      query: {
        default: 'INSERT INTO [myTable] ([firstName]) VALUES ($sequelize_1)',
      },
    });
  });

  it('generates an insert query for a table and globally set schema', () => {
    const sequelizeSchema = createSequelizeInstance({ schema: 'mySchema' });
    const queryGeneratorSchema = sequelizeSchema.queryGenerator;

    expectsql(queryGeneratorSchema.insertQuery('myTable', { firstName: 'John' }), {
      bind: { default: { sequelize_1: 'John' } },
      query: {
        default: 'INSERT INTO [mySchema].[myTable] ([firstName]) VALUES ($sequelize_1)',
        sqlite: 'INSERT INTO `mySchema.myTable` (`firstName`) VALUES ($sequelize_1)',
      },
    });
  });

  it('generates an insert query for a table and schema with custom delimiter argument', () => {
    // This test is only relevant for dialects that do not support schemas
    if (sequelize.dialect.supports.schemas) {
      return;
    }

    expectsql(() => queryGenerator.insertQuery({ tableName: 'myTable', schema: 'mySchema', delimiter: 'custom' }, { firstName: 'John' }), {
      bind: { default: { sequelize_1: 'John' } },
      query: {
        sqlite: 'INSERT INTO `mySchemacustommyTable` (`firstName`) VALUES ($sequelize_1)',
      },
    });
  });

  describe('ignoreNull', () => {
    it('retains null values by default', () => {
      expectsql(queryGenerator.insertQuery(User, { firstName: null }), {
        bind: { default: { sequelize_1: null } },
        query: {
          default: 'INSERT INTO [Users] ([firstName]) VALUES ($sequelize_1)',
        },
      });
    });

    it('omits underfined properties', () => {
      const { query, bind } = queryGenerator.insertQuery('myTable', { value: undefined, name: 'bar' });
      expectsql(query, {
        default: 'INSERT INTO [myTable] ([name]) VALUES ($sequelize_1)',
      });

      expect(bind).to.deep.eq({ sequelize_1: 'bar' });
    });

    const customSequelize = createSequelizeInstance({ omitNull: true });

    it('omits null values when true', () => {
      expectsql(() => customSequelize.queryGenerator.insertQuery(User, { firstName: null }), {
        bind: {},
        query: {
          default: 'INSERT INTO [Users] DEFAULT VALUES',
          'db2 snowflake': 'INSERT INTO "Users" VALUES ()',
          'mariadb mysql': 'INSERT INTO `Users` VALUES ()',
        },
      });
    });

    it('omits undefined values when true', () => {
      expectsql(() => customSequelize.queryGenerator.insertQuery(User, { firstName: undefined }), {
        bind: {},
        query: {
          default: 'INSERT INTO [Users] DEFAULT VALUES',
          'db2 snowflake': 'INSERT INTO "Users" VALUES ()',
          'mariadb mysql': 'INSERT INTO `Users` VALUES ()',
        },
      });
    });
  });

  describe('bind and replacements', () => {
    // you'll find more replacement tests in query-generator tests
    it('parses named replacements in literals', () => {
      expectsql(queryGenerator.insertQuery(User, { firstName: literal(':name') }, { replacements: { name: 'Zoe' } }), {
        bind: {},
        query: {
          default: `INSERT INTO [Users] ([firstName]) VALUES ('Zoe')`,
          mssql: `INSERT INTO [Users] ([firstName]) VALUES (N'Zoe')`,
        },
      });
    });

    it('supports named bind parameters in literals', () => {
      expectsql(queryGenerator.insertQuery(User, { firstName: 'John', lastName: literal('$lastName'), username: 'jd' }), {
        bind: { default: { sequelize_1: 'John', sequelize_2: 'jd' } },
        query: {
          default: `INSERT INTO [Users] ([firstName],[lastName],[username]) VALUES ($sequelize_1,$lastName,$sequelize_2)`,
        },
      });
    });

    it('parses positional bind parameters in literals', () => {
    // lastName's bind position being changed from $1 to $2 is intentional: bind array order must match their order in the query in some dialects.
      expectsql(queryGenerator.insertQuery(User, { firstName: 'John', lastName: literal('$1'), username: 'jd' }), {
        bind: { default: { sequelize_1: 'John', sequelize_2: 'jd' } },
        query: {
          default: `INSERT INTO [Users] ([firstName],[lastName],[username]) VALUES ($sequelize_1,$1,$sequelize_2)`,
        },
      });
    });

    it('parses bind parameters in literals even with bindParams: false', () => {
      const { query, bind } = queryGenerator.insertQuery(User, {
        firstName: 'John',
        lastName: literal('$1'),
        username: 'jd',
      }, {
      // @ts-expect-error -- intentionally testing bindParams: false
        bindParam: false,
      });

      expectsql(query, {
        default: `INSERT INTO [Users] ([firstName],[lastName],[username]) VALUES ('John',$1,'jd')`,
        mssql: `INSERT INTO [Users] ([firstName],[lastName],[username]) VALUES (N'John',$1,N'jd')`,
      });

      expect(bind).to.be.undefined;
    });

    // This test was added due to a regression where these values were being converted to strings
    it('binds number values', () => {
      if (!sequelize.dialect.supports.dataTypes.ARRAY) {
        return;
      }

      expectsql(queryGenerator.insertQuery(User, { numbers: [1, 2, 3] }), {
        bind: { default: { sequelize_1: [1, 2, 3] } },
        query: {
          default: `INSERT INTO "Users" ([numbers]) VALUES ($sequelize_1)`,
        },
      });
    });

    it('binds date values', () => {
      const result = queryGenerator.insertQuery('myTable', { birthday: new Date('2011-03-27T10:01:55Z') });
      expectsql(result, {
        query: {
          default: 'INSERT INTO [myTable] ([birthday]) VALUES ($sequelize_1)',
        },
        bind: {
          default: {
            sequelize_1: '2011-03-27 10:01:55.000',
          },
          mssql: {
            sequelize_1: '2011-03-27 10:01:55.000 +00:00',
          },
          postgres: {
            sequelize_1: '2011-03-27 10:01:55.000 +00:00',
          },
          sqlite: {
            sequelize_1: '2011-03-27 10:01:55.000 +00:00',
          },
        },
      });
    });

    it('binds boolean values', () => {
      expectsql(queryGenerator.insertQuery('myTable', { positive: true, negative: false }), {
        query: {
          default: 'INSERT INTO [myTable] ([positive],[negative]) VALUES ($sequelize_1,$sequelize_2)',
        },
        bind: {
          default: {
            sequelize_1: 1,
            sequelize_2: 0,
          },
          db2: {
            sequelize_1: true,
            sequelize_2: false,
          },
          postgres: {
            sequelize_1: true,
            sequelize_2: false,
          },
          snowflake: {
            sequelize_1: true,
            sequelize_2: false,
          },
        },
      });
    });

    it('binds Buffer values', () => {
      expectsql(queryGenerator.insertQuery('myTable', { data: Buffer.from('Sequelize') }, undefined, { data: { type: DataTypes.BLOB() } }), {
        query: {
          default: 'INSERT INTO [myTable] ([data]) VALUES ($sequelize_1)',
        },
        bind: { default: { sequelize_1: Buffer.from('Sequelize') } },
      });
    });
  });

  describe('returning', () => {
    it('supports returning: true', () => {
      expectsql(() => queryGenerator.insertQuery('myTable', { firstName: 'John' }, { returning: true }).query, {
        default: buildInvalidOptionReceivedError('insertQuery', sequelize.dialect.name, ['returning']),
        mssql: 'INSERT INTO [myTable] ([firstName]) OUTPUT INSERTED.* VALUES ($sequelize_1)',
        postgres: `INSERT INTO "myTable" ("firstName") VALUES ($sequelize_1) RETURNING *`,
        sqlite: 'INSERT INTO `myTable` (`firstName`) VALUES ($sequelize_1) RETURNING *',
        'db2 ibmi': 'SELECT * FROM FINAL TABLE (INSERT INTO "myTable" ("firstName") VALUES ($sequelize_1))',
      });
    });

    it('supports returning: true with attributes', () => {
      expectsql(() => queryGenerator.insertQuery('myTable', { firstName: 'John' }, { returning: true }, { firstName: { type: DataTypes.STRING() } }).query, {
        default: buildInvalidOptionReceivedError('insertQuery', sequelize.dialect.name, ['returning']),
        mssql: 'INSERT INTO [myTable] ([firstName]) OUTPUT INSERTED.[firstName] VALUES ($sequelize_1)',
        postgres: `INSERT INTO "myTable" ("firstName") VALUES ($sequelize_1) RETURNING "firstName"`,
        sqlite: 'INSERT INTO `myTable` (`firstName`) VALUES ($sequelize_1) RETURNING `firstName`',
        'db2 ibmi': 'SELECT "firstName" FROM FINAL TABLE (INSERT INTO "myTable" ("firstName") VALUES ($sequelize_1))',
      });
    });

    it('supports returning: true with a model', () => {
      expectsql(() => queryGenerator.insertQuery(User, { firstName: 'John' }, { returning: true }).query, {
        default: buildInvalidOptionReceivedError('insertQuery', sequelize.dialect.name, ['returning']),
        mssql: 'INSERT INTO [Users] ([firstName]) OUTPUT INSERTED.[id], INSERTED.[firstName], INSERTED.[date] VALUES ($sequelize_1)',
        postgres: `INSERT INTO "Users" ("firstName") VALUES ($sequelize_1) RETURNING "id", "firstName", "date"`,
        sqlite: 'INSERT INTO `Users` (`firstName`) VALUES ($sequelize_1) RETURNING `id`, `firstName`, `date`',
        'db2 ibmi': 'SELECT "id", "firstName", "date" FROM FINAL TABLE (INSERT INTO "Users" ("firstName") VALUES ($sequelize_1))',
      });
    });

    it('supports array of strings (column names)', () => {
      expectsql(() => queryGenerator.insertQuery('myTable', { firstName: 'John' }, { returning: ['*', 'myColumn'] }).query, {
        default: buildInvalidOptionReceivedError('insertQuery', sequelize.dialect.name, ['returning']),
        mssql: 'INSERT INTO [myTable] ([firstName]) OUTPUT INSERTED.[*], INSERTED.[myColumn] VALUES ($sequelize_1)',
        postgres: `INSERT INTO "myTable" ("firstName") VALUES ($sequelize_1) RETURNING "*", "myColumn"`,
        sqlite: 'INSERT INTO `myTable` (`firstName`) VALUES ($sequelize_1) RETURNING `*`, `myColumn`',
        'db2 ibmi': 'SELECT "*", "myColumn" FROM FINAL TABLE (INSERT INTO "myTable" ("firstName") VALUES ($sequelize_1))',
      });
    });

    it('supports array of strings (column names) with attributes', () => {
      expectsql(() => queryGenerator.insertQuery('myTable', { firstName: 'John' }, { returning: ['*', 'myColumn'] }, { firstName: { type: DataTypes.STRING() } }).query, {
        default: buildInvalidOptionReceivedError('insertQuery', sequelize.dialect.name, ['returning']),
        mssql: 'INSERT INTO [myTable] ([firstName]) OUTPUT INSERTED.[*], INSERTED.[myColumn] VALUES ($sequelize_1)',
        postgres: `INSERT INTO "myTable" ("firstName") VALUES ($sequelize_1) RETURNING "*", "myColumn"`,
        sqlite: 'INSERT INTO `myTable` (`firstName`) VALUES ($sequelize_1) RETURNING `*`, `myColumn`',
        'db2 ibmi': 'SELECT "*", "myColumn" FROM FINAL TABLE (INSERT INTO "myTable" ("firstName") VALUES ($sequelize_1))',
      });
    });

    it('supports array of strings (column names) with a model', () => {
      expectsql(() => queryGenerator.insertQuery(User, { firstName: 'John' }, { returning: ['*', 'myColumn'] }).query, {
        default: buildInvalidOptionReceivedError('insertQuery', sequelize.dialect.name, ['returning']),
        mssql: 'INSERT INTO [Users] ([firstName]) OUTPUT INSERTED.[*], INSERTED.[myColumn] VALUES ($sequelize_1)',
        postgres: `INSERT INTO "Users" ("firstName") VALUES ($sequelize_1) RETURNING "*", "myColumn"`,
        sqlite: 'INSERT INTO `Users` (`firstName`) VALUES ($sequelize_1) RETURNING `*`, `myColumn`',
        'db2 ibmi': 'SELECT "*", "myColumn" FROM FINAL TABLE (INSERT INTO "Users" ("firstName") VALUES ($sequelize_1))',
      });
    });

    it('supports array of literals', () => {
      expectsql(() => queryGenerator.insertQuery('myTable', { firstName: 'John' }, { returning: [literal('*')] }).query, {
        default: buildInvalidOptionReceivedError('insertQuery', sequelize.dialect.name, ['returning']),
        mssql: new Error('literal() cannot be used in the "returning" option array in mssql. Use col(), or a string instead.'),
        postgres: `INSERT INTO "myTable" ("firstName") VALUES ($sequelize_1) RETURNING *`,
        sqlite: 'INSERT INTO `myTable` (`firstName`) VALUES ($sequelize_1) RETURNING *',
        'db2 ibmi': 'SELECT * FROM FINAL TABLE (INSERT INTO "myTable" ("firstName") VALUES ($sequelize_1))',
      });
    });

    it('supports array of literals with attributes', () => {
      expectsql(() => queryGenerator.insertQuery('myTable', { firstName: 'John' }, { returning: [literal('*')] }, { firstName: { type: DataTypes.STRING() } }).query, {
        default: buildInvalidOptionReceivedError('insertQuery', sequelize.dialect.name, ['returning']),
        mssql: new Error('literal() cannot be used in the "returning" option array in mssql. Use col(), or a string instead.'),
        postgres: `INSERT INTO "myTable" ("firstName") VALUES ($sequelize_1) RETURNING *`,
        sqlite: 'INSERT INTO `myTable` (`firstName`) VALUES ($sequelize_1) RETURNING *',
        'db2 ibmi': 'SELECT * FROM FINAL TABLE (INSERT INTO "myTable" ("firstName") VALUES ($sequelize_1))',
      });
    });

    it('supports array of literals with a model', () => {
      expectsql(() => queryGenerator.insertQuery(User, { firstName: 'John' }, { returning: [literal('*')] }).query, {
        default: buildInvalidOptionReceivedError('insertQuery', sequelize.dialect.name, ['returning']),
        mssql: new Error('literal() cannot be used in the "returning" option array in mssql. Use col(), or a string instead.'),
        postgres: `INSERT INTO "Users" ("firstName") VALUES ($sequelize_1) RETURNING *`,
        sqlite: 'INSERT INTO `Users` (`firstName`) VALUES ($sequelize_1) RETURNING *',
        'db2 ibmi': 'SELECT * FROM FINAL TABLE (INSERT INTO "Users" ("firstName") VALUES ($sequelize_1))',
      });
    });

    it('uses temporary table for `returning` option with `hasTrigger`', () => {
      expectsql(() => queryGenerator.insertQuery('myTable', { firstName: 'John' }, { returning: true, hasTrigger: true }).query, {
        default: buildInvalidOptionReceivedError('insertQuery', sequelize.dialect.name, ['returning']),
        mssql: new Error('Cannot use "returning" option with no attributes'),
        postgres: `INSERT INTO "myTable" ("firstName") VALUES ($sequelize_1) RETURNING *`,
        sqlite: 'INSERT INTO `myTable` (`firstName`) VALUES ($sequelize_1) RETURNING *',
        'db2 ibmi': 'SELECT * FROM FINAL TABLE (INSERT INTO "myTable" ("firstName") VALUES ($sequelize_1))',
      });
    });

    it('uses temporary table for `returning` option with `hasTrigger with attributes`', () => {
      expectsql(() => queryGenerator.insertQuery('myTable', { firstName: 'John' }, { returning: true, hasTrigger: true }, { firstName: { type: DataTypes.STRING() } }).query, {
        default: buildInvalidOptionReceivedError('insertQuery', sequelize.dialect.name, ['returning']),
        mssql: `DECLARE @output_table TABLE ([firstName] NVARCHAR(255));INSERT INTO [myTable] ([firstName])
        OUTPUT INSERTED.[firstName] INTO @output_table VALUES ($sequelize_1);SELECT * FROM @output_table`,
        postgres: `INSERT INTO "myTable" ("firstName") VALUES ($sequelize_1) RETURNING "firstName"`,
        sqlite: 'INSERT INTO `myTable` (`firstName`) VALUES ($sequelize_1) RETURNING `firstName`',
        'db2 ibmi': 'SELECT "firstName" FROM FINAL TABLE (INSERT INTO "myTable" ("firstName") VALUES ($sequelize_1))',
      });
    });

    it('uses temporary table for `returning` option with `hasTrigger` with a model', () => {
      expectsql(() => queryGenerator.insertQuery(User, { firstName: 'John' }, { returning: true, hasTrigger: true }).query, {
        default: buildInvalidOptionReceivedError('insertQuery', sequelize.dialect.name, ['returning']),
        mssql: `DECLARE @output_table TABLE ([id] INTEGER, [firstName] NVARCHAR(255), [date] DATETIMEOFFSET(3));INSERT INTO [Users] ([firstName])
        OUTPUT INSERTED.[id], INSERTED.[firstName], INSERTED.[date] INTO @output_table VALUES ($sequelize_1);SELECT * FROM @output_table`,
        postgres: `INSERT INTO "Users" ("firstName") VALUES ($sequelize_1) RETURNING "id", "firstName", "date"`,
        sqlite: 'INSERT INTO `Users` (`firstName`) VALUES ($sequelize_1) RETURNING `id`, `firstName`, `date`',
        'db2 ibmi': 'SELECT "id", "firstName", "date" FROM FINAL TABLE (INSERT INTO "Users" ("firstName") VALUES ($sequelize_1))',
      });
    });
  });
});
