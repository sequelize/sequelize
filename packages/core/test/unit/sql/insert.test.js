'use strict';

const Support = require('../../support');
const { DataTypes } = require('@sequelize/core');
const { expect } = require('chai');

const expectsql = Support.expectsql;
const current = Support.sequelize;
const sql = current.dialect.queryGenerator;
const dialect = current.dialect;

// Notice: [] will be replaced by dialect specific tick/quote character when there is not dialect specific expectation but only a default expectation

describe(Support.getTestDialectTeaser('SQL'), () => {
  describe('insert', () => {
    it('with temp table for trigger', () => {
      const User = Support.sequelize.define(
        'user',
        {
          username: {
            type: DataTypes.STRING,
            field: 'user_name',
          },
        },
        {
          timestamps: false,
          hasTrigger: true,
        },
      );

      const options = {
        returning: true,
        hasTrigger: true,
      };
      expectsql(
        sql.insertQuery(User.table, { user_name: 'triggertest' }, User.getAttributes(), options),
        {
          query: {
            ibmi: 'SELECT * FROM FINAL TABLE (INSERT INTO "users" ("user_name") VALUES ($sequelize_1))',
            mssql:
              'DECLARE @tmp TABLE ([id] INTEGER,[user_name] NVARCHAR(255)); INSERT INTO [users] ([user_name]) OUTPUT INSERTED.[id], INSERTED.[user_name] INTO @tmp VALUES ($sequelize_1); SELECT * FROM @tmp;',
            sqlite3:
              'INSERT INTO `users` (`user_name`) VALUES ($sequelize_1) RETURNING `id`, `user_name`;',
            postgres:
              'INSERT INTO "users" ("user_name") VALUES ($sequelize_1) RETURNING "id", "user_name";',
            db2: 'SELECT * FROM FINAL TABLE (INSERT INTO "users" ("user_name") VALUES ($sequelize_1));',
            snowflake: 'INSERT INTO "users" ("user_name") VALUES ($sequelize_1);',
            default: 'INSERT INTO `users` (`user_name`) VALUES ($sequelize_1);',
          },
          bind: { sequelize_1: 'triggertest' },
        },
      );
    });

    it('allow insert primary key with 0', () => {
      const M = Support.sequelize.define('m', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
      });

      expectsql(sql.insertQuery(M.table, { id: 0 }, M.getAttributes()), {
        query: {
          mssql:
            'SET IDENTITY_INSERT [ms] ON; INSERT INTO [ms] ([id]) VALUES ($sequelize_1); SET IDENTITY_INSERT [ms] OFF;',
          db2: 'SELECT * FROM FINAL TABLE (INSERT INTO "ms" ("id") VALUES ($sequelize_1));',
          ibmi: 'SELECT * FROM FINAL TABLE (INSERT INTO "ms" ("id") VALUES ($sequelize_1))',
          postgres: 'INSERT INTO "ms" ("id") VALUES ($sequelize_1);',
          snowflake: 'INSERT INTO "ms" ("id") VALUES ($sequelize_1);',
          default: 'INSERT INTO `ms` (`id`) VALUES ($sequelize_1);',
        },
        bind: { sequelize_1: 0 },
      });
    });

    it(
      current.dialect.supports.inserts.onConflictWhere
        ? 'adds conflictWhere clause to generated queries'
        : 'throws error if conflictWhere is provided',
      () => {
        const User = Support.sequelize.define(
          'user',
          {
            username: {
              type: DataTypes.STRING,
              field: 'user_name',
              primaryKey: true,
            },
            password: {
              type: DataTypes.STRING,
              field: 'pass_word',
            },
            createdAt: {
              type: DataTypes.DATE,
              field: 'created_at',
            },
            updatedAt: {
              type: DataTypes.DATE,
              field: 'updated_at',
            },
          },
          {
            timestamps: true,
          },
        );

        const upsertKeys = ['user_name'];

        let result;

        try {
          result = sql.insertQuery(
            User.table,
            { user_name: 'testuser', pass_word: '12345' },
            User.fieldRawAttributesMap,
            {
              updateOnDuplicate: ['user_name', 'pass_word', 'updated_at'],
              conflictWhere: {
                user_name: 'test where value',
              },
              upsertKeys,
            },
          );
        } catch (error) {
          result = error;
        }

        expectsql(result, {
          default: new Error('missing dialect support for conflictWhere option'),
          'postgres sqlite3': `INSERT INTO [users] ([user_name],[pass_word]) VALUES ($sequelize_1,$sequelize_2) ON CONFLICT ([user_name]) WHERE [user_name] = 'test where value' DO UPDATE SET [user_name]=EXCLUDED.[user_name],[pass_word]=EXCLUDED.[pass_word],[updated_at]=EXCLUDED.[updated_at];`,
        });
      },
    );
  });

  describe('dates', () => {
    if (!dialect.supports.globalTimeZoneConfig) {
      it('rejects specifying the global timezone option', () => {
        expect(() => Support.createSequelizeInstance({ timezone: 'CET' })).to.throw(
          'Setting a custom timezone is not supported',
        );
      });
    } else {
      it('supports the global timezone option', () => {
        const timezoneSequelize = Support.createSequelizeInstance({
          timezone: 'CET',
        });

        const User = timezoneSequelize.define(
          'user',
          {
            date: {
              type: DataTypes.DATE(3),
            },
          },
          {
            timestamps: false,
          },
        );

        expectsql(
          timezoneSequelize.dialect.queryGenerator.insertQuery(
            User.table,
            { date: new Date(Date.UTC(2015, 0, 20)) },
            User.getAttributes(),
            {},
          ),
          {
            query: {
              default: 'INSERT INTO [users] ([date]) VALUES ($sequelize_1);',
            },
            bind: {
              // these dialects change the DB-side timezone, and the input doesn't specify the timezone offset, so we have to offset the value ourselves
              // because it will be interpreted as CET by the dialect.
              snowflake: { sequelize_1: '2015-01-20 01:00:00.000' },
              mysql: { sequelize_1: '2015-01-20 01:00:00.000' },
              mariadb: { sequelize_1: '2015-01-20 01:00:00.000' },
              // These dialects do specify the offset, so they can use whichever offset they want.
              postgres: { sequelize_1: '2015-01-20 01:00:00.000 +01:00' },
            },
          },
        );
      });
    }

    it('formats the date correctly when inserting', () => {
      const User = current.define(
        'user',
        {
          date: {
            type: DataTypes.DATE(3),
          },
        },
        {
          timestamps: false,
        },
      );

      expectsql(
        current.dialect.queryGenerator.insertQuery(
          User.table,
          { date: new Date(Date.UTC(2015, 0, 20)) },
          User.getAttributes(),
          {},
        ),
        {
          query: {
            ibmi: 'SELECT * FROM FINAL TABLE (INSERT INTO "users" ("date") VALUES ($sequelize_1))',
            postgres: 'INSERT INTO "users" ("date") VALUES ($sequelize_1);',
            db2: 'SELECT * FROM FINAL TABLE (INSERT INTO "users" ("date") VALUES ($sequelize_1));',
            snowflake: 'INSERT INTO "users" ("date") VALUES ($sequelize_1);',
            mssql: 'INSERT INTO [users] ([date]) VALUES ($sequelize_1);',
            default: 'INSERT INTO `users` (`date`) VALUES ($sequelize_1);',
          },
          bind: {
            ibmi: { sequelize_1: '2015-01-20 00:00:00.000' },
            db2: { sequelize_1: '2015-01-20 00:00:00.000' },
            snowflake: { sequelize_1: '2015-01-20 00:00:00.000' },
            mysql: { sequelize_1: '2015-01-20 00:00:00.000' },
            mariadb: { sequelize_1: '2015-01-20 00:00:00.000' },
            sqlite3: { sequelize_1: '2015-01-20 00:00:00.000 +00:00' },
            mssql: { sequelize_1: '2015-01-20 00:00:00.000 +00:00' },
            postgres: { sequelize_1: '2015-01-20 00:00:00.000 +00:00' },
          },
        },
      );
    });

    it('formats date correctly when sub-second precision is explicitly specified', () => {
      const User = current.define(
        'user',
        {
          date: {
            type: DataTypes.DATE(3),
          },
        },
        {
          timestamps: false,
        },
      );

      expectsql(
        current.dialect.queryGenerator.insertQuery(
          User.table,
          { date: new Date(Date.UTC(2015, 0, 20, 1, 2, 3, 89)) },
          User.getAttributes(),
          {},
        ),
        {
          query: {
            ibmi: 'SELECT * FROM FINAL TABLE (INSERT INTO "users" ("date") VALUES ($sequelize_1))',
            postgres: 'INSERT INTO "users" ("date") VALUES ($sequelize_1);',
            db2: 'SELECT * FROM FINAL TABLE (INSERT INTO "users" ("date") VALUES ($sequelize_1));',
            snowflake: 'INSERT INTO "users" ("date") VALUES ($sequelize_1);',
            mssql: 'INSERT INTO [users] ([date]) VALUES ($sequelize_1);',
            default: 'INSERT INTO `users` (`date`) VALUES ($sequelize_1);',
          },
          bind: {
            ibmi: { sequelize_1: '2015-01-20 01:02:03.089' },
            db2: { sequelize_1: '2015-01-20 01:02:03.089' },
            snowflake: { sequelize_1: '2015-01-20 01:02:03.089' },
            mariadb: { sequelize_1: '2015-01-20 01:02:03.089' },
            mysql: { sequelize_1: '2015-01-20 01:02:03.089' },
            sqlite3: { sequelize_1: '2015-01-20 01:02:03.089 +00:00' },
            postgres: { sequelize_1: '2015-01-20 01:02:03.089 +00:00' },
            mssql: { sequelize_1: '2015-01-20 01:02:03.089 +00:00' },
          },
        },
      );
    });
  });

  describe('strings', () => {
    it('formats null characters correctly when inserting', () => {
      const User = Support.sequelize.define(
        'user',
        {
          username: {
            type: DataTypes.STRING,
            field: 'user_name',
          },
        },
        {
          timestamps: false,
        },
      );

      expectsql(sql.insertQuery(User.table, { user_name: 'null\0test' }, User.getAttributes()), {
        query: {
          ibmi: 'SELECT * FROM FINAL TABLE (INSERT INTO "users" ("user_name") VALUES ($sequelize_1))',
          postgres: 'INSERT INTO "users" ("user_name") VALUES ($sequelize_1);',
          db2: 'SELECT * FROM FINAL TABLE (INSERT INTO "users" ("user_name") VALUES ($sequelize_1));',
          snowflake: 'INSERT INTO "users" ("user_name") VALUES ($sequelize_1);',
          mssql: 'INSERT INTO [users] ([user_name]) VALUES ($sequelize_1);',
          default: 'INSERT INTO `users` (`user_name`) VALUES ($sequelize_1);',
        },
        bind: {
          postgres: { sequelize_1: 'null\u0000test' },
          default: { sequelize_1: 'null\0test' },
        },
      });
    });
  });

  describe('bulkCreate', () => {
    it('bulk create with onDuplicateKeyUpdate', () => {
      const User = Support.sequelize.define(
        'user',
        {
          username: {
            type: DataTypes.STRING,
            field: 'user_name',
            primaryKey: true,
          },
          password: {
            type: DataTypes.STRING,
            field: 'pass_word',
          },
          createdAt: {
            field: 'created_at',
          },
          updatedAt: {
            field: 'updated_at',
          },
        },
        {
          timestamps: true,
        },
      );

      // mapping primary keys to their "field" override values
      const primaryKeys = User.primaryKeyAttributes.map(
        attr => User.getAttributes()[attr].field || attr,
      );

      expectsql(
        sql.bulkInsertQuery(
          User.table,
          [{ user_name: 'testuser', pass_word: '12345' }],
          { updateOnDuplicate: ['user_name', 'pass_word', 'updated_at'], upsertKeys: primaryKeys },
          User.fieldRawAttributesMap,
        ),
        {
          default: "INSERT INTO `users` (`user_name`,`pass_word`) VALUES ('testuser','12345');",
          ibmi: 'SELECT * FROM FINAL TABLE (INSERT INTO "users" ("user_name","pass_word") VALUES (\'testuser\',\'12345\'))',
          snowflake:
            'INSERT INTO "users" ("user_name","pass_word") VALUES (\'testuser\',\'12345\');',
          postgres:
            'INSERT INTO "users" ("user_name","pass_word") VALUES (\'testuser\',\'12345\') ON CONFLICT ("user_name") DO UPDATE SET "user_name"=EXCLUDED."user_name","pass_word"=EXCLUDED."pass_word","updated_at"=EXCLUDED."updated_at";',
          mssql: "INSERT INTO [users] ([user_name],[pass_word]) VALUES (N'testuser',N'12345');",
          db2: 'INSERT INTO "users" ("user_name","pass_word") VALUES (\'testuser\',\'12345\');',
          mariadb:
            "INSERT INTO `users` (`user_name`,`pass_word`) VALUES ('testuser','12345') ON DUPLICATE KEY UPDATE `user_name`=VALUES(`user_name`),`pass_word`=VALUES(`pass_word`),`updated_at`=VALUES(`updated_at`);",
          mysql:
            "INSERT INTO `users` (`user_name`,`pass_word`) VALUES ('testuser','12345') ON DUPLICATE KEY UPDATE `user_name`=VALUES(`user_name`),`pass_word`=VALUES(`pass_word`),`updated_at`=VALUES(`updated_at`);",
          sqlite3:
            "INSERT INTO `users` (`user_name`,`pass_word`) VALUES ('testuser','12345') ON CONFLICT (`user_name`) DO UPDATE SET `user_name`=EXCLUDED.`user_name`,`pass_word`=EXCLUDED.`pass_word`,`updated_at`=EXCLUDED.`updated_at`;",
        },
      );
    });

    it('allow bulk insert primary key with 0', () => {
      const M = Support.sequelize.define('m', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
      });

      expectsql(
        sql.bulkInsertQuery(M.table, [{ id: 0 }, { id: null }], {}, M.fieldRawAttributesMap),
        {
          query: {
            mssql:
              'SET IDENTITY_INSERT [ms] ON; INSERT INTO [ms] DEFAULT VALUES;INSERT INTO [ms] ([id]) VALUES (0),(NULL); SET IDENTITY_INSERT [ms] OFF;',
            postgres: 'INSERT INTO "ms" ("id") VALUES (0),(DEFAULT);',
            db2: 'INSERT INTO "ms" VALUES (1);INSERT INTO "ms" ("id") VALUES (0),(NULL);',
            ibmi: 'SELECT * FROM FINAL TABLE (INSERT INTO "ms" ("id") VALUES (0),(DEFAULT))',
            snowflake: 'INSERT INTO "ms" ("id") VALUES (0),(NULL);',
            default: 'INSERT INTO `ms` (`id`) VALUES (0),(NULL);',
          },
        },
      );
    });

    if (current.dialect.supports.inserts.updateOnDuplicate) {
      it('correctly generates SQL for conflictWhere', () => {
        const User = Support.sequelize.define(
          'user',
          {
            username: {
              type: DataTypes.STRING,
              field: 'user_name',
              primaryKey: true,
            },
            password: {
              type: DataTypes.STRING,
              field: 'pass_word',
            },
            createdAt: {
              type: DataTypes.DATE,
              field: 'created_at',
            },
            updatedAt: {
              type: DataTypes.DATE,
              field: 'updated_at',
            },
            deletedAt: {
              type: DataTypes.DATE,
              field: 'deleted_at',
            },
          },
          {
            timestamps: true,
          },
        );

        // mapping primary keys to their "field" override values
        const primaryKeys = User.primaryKeyAttributes.map(
          attr => User.getAttributes()[attr].field || attr,
        );

        let result;

        try {
          result = sql.bulkInsertQuery(
            User.table,
            [{ user_name: 'testuser', pass_word: '12345' }],
            {
              updateOnDuplicate: ['user_name', 'pass_word', 'updated_at'],
              upsertKeys: primaryKeys,
              conflictWhere: { deleted_at: null },
            },
            User.fieldRawAttributesMap,
          );
        } catch (error) {
          result = error;
        }

        expectsql(result, {
          default: new Error(`conflictWhere not supported for dialect ${dialect.name}`),
          'postgres sqlite3':
            "INSERT INTO [users] ([user_name],[pass_word]) VALUES ('testuser','12345') ON CONFLICT ([user_name]) WHERE [deleted_at] IS NULL DO UPDATE SET [user_name]=EXCLUDED.[user_name],[pass_word]=EXCLUDED.[pass_word],[updated_at]=EXCLUDED.[updated_at];",
        });
      });
    }
  });
});
