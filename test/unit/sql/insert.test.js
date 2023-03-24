'use strict';

const Support   = require('../support'),
  DataTypes = require('sequelize/lib/data-types'),
  expectsql = Support.expectsql,
  current   = Support.sequelize,
  sql       = current.dialect.queryGenerator;

// Notice: [] will be replaced by dialect specific tick/quote character when there is not dialect specific expectation but only a default expectation

describe(Support.getTestDialectTeaser('SQL'), () => {
  describe('insert', () => {
    it('with temp table for trigger', () => {
      const User = Support.sequelize.define('user', {
        username: {
          type: DataTypes.STRING,
          field: 'user_name'
        }
      }, {
        timestamps: false,
        hasTrigger: true
      });

      const options = {
        returning: true,
        hasTrigger: true
      };
      expectsql(sql.insertQuery(User.tableName, { user_name: 'triggertest' }, User.rawAttributes, options),
        {
          query: {
            mssql: 'DECLARE @tmp TABLE ([id] INTEGER,[user_name] NVARCHAR(255)); INSERT INTO [users] ([user_name]) OUTPUT INSERTED.[id],INSERTED.[user_name] INTO @tmp VALUES ($1); SELECT * FROM @tmp;',
            postgres: 'INSERT INTO "users" ("user_name") VALUES ($1) RETURNING "id","user_name";',
            db2: 'SELECT * FROM FINAL TABLE(INSERT INTO "users" ("user_name") VALUES ($1));',
            snowflake: 'INSERT INTO "users" ("user_name") VALUES ($1);',
            oracle: 'INSERT INTO "users" ("user_name") VALUES (:1) RETURNING "id","user_name" INTO :2,:3;',
            default: 'INSERT INTO `users` (`user_name`) VALUES ($1);'
          },
          bind: ['triggertest']
        });

    });

    it('allow insert primary key with 0', () => {
      const M = Support.sequelize.define('m', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true
        }
      });

      expectsql(sql.insertQuery(M.tableName, { id: 0 }, M.rawAttributes),
        {
          query: {
            mssql: 'SET IDENTITY_INSERT [ms] ON; INSERT INTO [ms] ([id]) VALUES ($1); SET IDENTITY_INSERT [ms] OFF;',
            db2: 'SELECT * FROM FINAL TABLE(INSERT INTO "ms" ("id") VALUES ($1));',
            postgres: 'INSERT INTO "ms" ("id") VALUES ($1);',
            snowflake: 'INSERT INTO "ms" ("id") VALUES ($1);',
            oracle: 'INSERT INTO "ms" ("id") VALUES (:1);',
            default: 'INSERT INTO `ms` (`id`) VALUES ($1);'
          },
          bind: [0]
        });
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
            primaryKey: true
          },
          password: {
            type: DataTypes.STRING,
            field: 'pass_word'
          },
          createdAt: {
            type: DataTypes.DATE,
            field: 'created_at'
          },
          updatedAt: {
            type: DataTypes.DATE,
            field: 'updated_at'
          }
        },
        {
          timestamps: true
        }
      );

      const upsertKeys = ['user_name'];

      let result;

      try {
        result = sql.insertQuery(
          User.tableName,
          { user_name: 'testuser', pass_word: '12345' },
          User.fieldRawAttributesMap,
          {
            updateOnDuplicate: ['user_name', 'pass_word', 'updated_at'],
            conflictWhere: {
              user_name: 'test where value'
            },
            upsertKeys
          }
        );
      } catch (error) {
        result = error;
      }

      expectsql(result, {
        default: new Error(
          'missing dialect support for conflictWhere option'
        ),
        postgres:
          'INSERT INTO "users" ("user_name","pass_word") VALUES ($1,$2) ON CONFLICT ("user_name") WHERE "user_name" = \'test where value\' DO UPDATE SET "user_name"=EXCLUDED."user_name","pass_word"=EXCLUDED."pass_word","updated_at"=EXCLUDED."updated_at";',
        sqlite:
          'INSERT INTO `users` (`user_name`,`pass_word`) VALUES ($1,$2) ON CONFLICT (`user_name`) WHERE `user_name` = \'test where value\' DO UPDATE SET `user_name`=EXCLUDED.`user_name`,`pass_word`=EXCLUDED.`pass_word`,`updated_at`=EXCLUDED.`updated_at`;'
      });
    }
  );

  describe('dates', () => {
    it('formats the date correctly when inserting', () => {
      const timezoneSequelize = Support.createSequelizeInstance({
        timezone: Support.getTestDialect() === 'sqlite' ? '+00:00' : 'CET'
      });

      const User = timezoneSequelize.define('user', {
        date: {
          type: DataTypes.DATE
        }
      }, {
        timestamps: false
      });

      expectsql(timezoneSequelize.dialect.queryGenerator.insertQuery(User.tableName, { date: new Date(Date.UTC(2015, 0, 20)) }, User.rawAttributes, {}),
        {
          query: {
            postgres: 'INSERT INTO "users" ("date") VALUES ($1);',
            db2: 'SELECT * FROM FINAL TABLE(INSERT INTO "users" ("date") VALUES ($1));',
            snowflake: 'INSERT INTO "users" ("date") VALUES ($1);',
            oracle: 'INSERT INTO "users" ("date") VALUES (:1);',
            mssql: 'INSERT INTO [users] ([date]) VALUES ($1);',
            default: 'INSERT INTO `users` (`date`) VALUES ($1);'
          },
          bind: {
            sqlite: ['2015-01-20 00:00:00.000 +00:00'],
            db2: ['2015-01-20 01:00:00'],
            mysql: ['2015-01-20 01:00:00'],
            snowflake: ['2015-01-20 01:00:00'],
            mariadb: ['2015-01-20 01:00:00.000'],
            oracle: [new Date(Date.UTC(2015, 0, 20))],
            default: ['2015-01-20 01:00:00.000 +01:00']
          }
        });
    });

    it('formats date correctly when sub-second precision is explicitly specified', () => {
      const timezoneSequelize = Support.createSequelizeInstance({
        timezone: Support.getTestDialect() === 'sqlite' ? '+00:00' : 'CET'
      });

      const User = timezoneSequelize.define('user', {
        date: {
          type: DataTypes.DATE(3)
        }
      }, {
        timestamps: false
      });

      expectsql(timezoneSequelize.dialect.queryGenerator.insertQuery(User.tableName, { date: new Date(Date.UTC(2015, 0, 20, 1, 2, 3, 89)) }, User.rawAttributes, {}),
        {
          query: {
            postgres: 'INSERT INTO "users" ("date") VALUES ($1);',
            db2: 'SELECT * FROM FINAL TABLE(INSERT INTO "users" ("date") VALUES ($1));',
            snowflake: 'INSERT INTO "users" ("date") VALUES ($1);',
            mssql: 'INSERT INTO [users] ([date]) VALUES ($1);',
            oracle: 'INSERT INTO "users" ("date") VALUES (:1);',
            default: 'INSERT INTO `users` (`date`) VALUES ($1);'
          },
          bind: {
            sqlite: ['2015-01-20 01:02:03.089 +00:00'],
            mariadb: ['2015-01-20 02:02:03.089'],
            oracle: [new Date(Date.UTC(2015, 0, 20, 1, 2, 3, 89))],
            mysql: ['2015-01-20 02:02:03.089'],
            db2: ['2015-01-20 02:02:03.089'],
            snowflake: ['2015-01-20 02:02:03.089'],
            default: ['2015-01-20 02:02:03.089 +01:00']
          }
        });
    });
  });

  describe('strings', () => {
    it('formats null characters correctly when inserting', () => {
      const User = Support.sequelize.define('user', {
        username: {
          type: DataTypes.STRING,
          field: 'user_name'
        }
      }, {
        timestamps: false
      });

      expectsql(sql.insertQuery(User.tableName, { user_name: 'null\0test' }, User.rawAttributes),
        {
          query: {
            postgres: 'INSERT INTO "users" ("user_name") VALUES ($1);',
            db2: 'SELECT * FROM FINAL TABLE(INSERT INTO "users" ("user_name") VALUES ($1));',
            snowflake: 'INSERT INTO "users" ("user_name") VALUES ($1);',
            mssql: 'INSERT INTO [users] ([user_name]) VALUES ($1);',
            oracle: 'INSERT INTO "users" ("user_name") VALUES (:1);',
            default: 'INSERT INTO `users` (`user_name`) VALUES ($1);'
          },
          bind: {
            postgres: ['null\u0000test'],
            default: ['null\0test']
          }
        });
    });
  });

  describe('bulkCreate', () => {
    it('bulk create with onDuplicateKeyUpdate', () => {
      const User = Support.sequelize.define('user', {
        username: {
          type: DataTypes.STRING,
          field: 'user_name',
          primaryKey: true
        },
        password: {
          type: DataTypes.STRING,
          field: 'pass_word'
        },
        createdAt: {
          type: DataTypes.DATE,
          field: 'created_at'
        },
        updatedAt: {
          type: DataTypes.DATE,
          field: 'updated_at'
        }
      }, {
        timestamps: true
      });

      // mapping primary keys to their "field" override values
      const primaryKeys = User.primaryKeyAttributes.map(attr => User.rawAttributes[attr].field || attr);

      expectsql(sql.bulkInsertQuery(User.tableName, [{ user_name: 'testuser', pass_word: '12345' }], { updateOnDuplicate: ['user_name', 'pass_word', 'updated_at'], upsertKeys: primaryKeys }, User.fieldRawAttributesMap),
        {
          default: 'INSERT INTO `users` (`user_name`,`pass_word`) VALUES (\'testuser\',\'12345\');',
          snowflake: 'INSERT INTO "users" ("user_name","pass_word") VALUES (\'testuser\',\'12345\');',
          oracle: 'INSERT INTO "users" ("user_name","pass_word") VALUES (:1,:2)',
          postgres: 'INSERT INTO "users" ("user_name","pass_word") VALUES (\'testuser\',\'12345\') ON CONFLICT ("user_name") DO UPDATE SET "user_name"=EXCLUDED."user_name","pass_word"=EXCLUDED."pass_word","updated_at"=EXCLUDED."updated_at";',
          mssql: 'INSERT INTO [users] ([user_name],[pass_word]) VALUES (N\'testuser\',N\'12345\');',
          db2: 'INSERT INTO "users" ("user_name","pass_word") VALUES (\'testuser\',\'12345\');',
          mariadb: 'INSERT INTO `users` (`user_name`,`pass_word`) VALUES (\'testuser\',\'12345\') ON DUPLICATE KEY UPDATE `user_name`=VALUES(`user_name`),`pass_word`=VALUES(`pass_word`),`updated_at`=VALUES(`updated_at`);',
          mysql: 'INSERT INTO `users` (`user_name`,`pass_word`) VALUES (\'testuser\',\'12345\') ON DUPLICATE KEY UPDATE `user_name`=VALUES(`user_name`),`pass_word`=VALUES(`pass_word`),`updated_at`=VALUES(`updated_at`);',
          sqlite: 'INSERT INTO `users` (`user_name`,`pass_word`) VALUES (\'testuser\',\'12345\') ON CONFLICT (`user_name`) DO UPDATE SET `user_name`=EXCLUDED.`user_name`,`pass_word`=EXCLUDED.`pass_word`,`updated_at`=EXCLUDED.`updated_at`;'
        });
    });

    // Oracle dialect doesn't support mix of null and non-null in auto-increment column
    (current.dialect.name !== 'oracle' ? it : it.skip)('allow bulk insert primary key with 0', () => {
      const M = Support.sequelize.define('m', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true
        }
      });

      expectsql(sql.bulkInsertQuery(M.tableName, [{ id: 0 }, { id: null }], {}, M.fieldRawAttributesMap),
        {
          query: {
            mssql: 'SET IDENTITY_INSERT [ms] ON; INSERT INTO [ms] DEFAULT VALUES;INSERT INTO [ms] ([id]) VALUES (0),(NULL);; SET IDENTITY_INSERT [ms] OFF;',
            postgres: 'INSERT INTO "ms" ("id") VALUES (0),(DEFAULT);',
            db2: 'INSERT INTO "ms" VALUES (1);INSERT INTO "ms" ("id") VALUES (0),(NULL);',
            snowflake: 'INSERT INTO "ms" ("id") VALUES (0),(NULL);',
            default: 'INSERT INTO `ms` (`id`) VALUES (0),(NULL);'
          }
        });
    });

    if (
      current.dialect.supports.inserts.updateOnDuplicate
    ) {
      it('correctly generates SQL for conflictWhere', () => {
        const User = Support.sequelize.define(
          'user',
          {
            username: {
              type: DataTypes.STRING,
              field: 'user_name',
              primaryKey: true
            },
            password: {
              type: DataTypes.STRING,
              field: 'pass_word'
            },
            createdAt: {
              type: DataTypes.DATE,
              field: 'created_at'
            },
            updatedAt: {
              type: DataTypes.DATE,
              field: 'updated_at'
            },
            deletedAt: {
              type: DataTypes.DATE,
              field: 'deleted_at'
            }
          },
          {
            timestamps: true
          }
        );

        // mapping primary keys to their "field" override values
        const primaryKeys = User.primaryKeyAttributes.map(attr => User.getAttributes()[attr].field || attr);

        let result;

        try {
          result = sql.bulkInsertQuery(
            User.tableName,
            [{ user_name: 'testuser', pass_word: '12345' }],
            {
              updateOnDuplicate: ['user_name', 'pass_word', 'updated_at'],
              upsertKeys: primaryKeys,
              conflictWhere: { deleted_at: null }
            },
            User.fieldRawAttributesMap
          );
        } catch (error) {
          result = error;
        }

        expectsql(result, {
          default: new Error(
            `conflictWhere not supported for dialect ${current.dialect.name}`
          ),
          'postgres':
            'INSERT INTO "users" ("user_name","pass_word") VALUES (\'testuser\',\'12345\') ON CONFLICT ("user_name") WHERE "deleted_at" IS NULL DO UPDATE SET "user_name"=EXCLUDED."user_name","pass_word"=EXCLUDED."pass_word","updated_at"=EXCLUDED."updated_at";',
          'sqlite':
            'INSERT INTO `users` (`user_name`,`pass_word`) VALUES (\'testuser\',\'12345\') ON CONFLICT (`user_name`) WHERE `deleted_at` IS NULL DO UPDATE SET `user_name`=EXCLUDED.`user_name`,`pass_word`=EXCLUDED.`pass_word`,`updated_at`=EXCLUDED.`updated_at`;'
        });
      });
    }
  });
});
