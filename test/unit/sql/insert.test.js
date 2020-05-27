'use strict';

const Support   = require('../support'),
  DataTypes = require('../../../lib/data-types'),
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
            default: 'INSERT INTO `users` (`user_name`) VALUES ($1);'
          },
          bind: ['triggertest']
        });

    });
  });

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
            mssql: 'INSERT INTO [users] ([date]) VALUES ($1);',
            default: 'INSERT INTO `users` (`date`) VALUES ($1);'
          },
          bind: {
            sqlite: ['2015-01-20 00:00:00.000 +00:00'],
            mysql: ['2015-01-20 01:00:00'],
            mariadb: ['2015-01-20 01:00:00.000'],
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
            mssql: 'INSERT INTO [users] ([date]) VALUES ($1);',
            default: 'INSERT INTO `users` (`date`) VALUES ($1);'
          },
          bind: {
            sqlite: ['2015-01-20 01:02:03.089 +00:00'],
            mariadb: ['2015-01-20 02:02:03.089'],
            mysql: ['2015-01-20 02:02:03.089'],
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
            mssql: 'INSERT INTO [users] ([user_name]) VALUES ($1);',
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
          postgres: 'INSERT INTO "users" ("user_name","pass_word") VALUES (\'testuser\',\'12345\') ON CONFLICT ("user_name") DO UPDATE SET "user_name"=EXCLUDED."user_name","pass_word"=EXCLUDED."pass_word","updated_at"=EXCLUDED."updated_at";',
          mssql: 'INSERT INTO [users] ([user_name],[pass_word]) VALUES (N\'testuser\',N\'12345\');',
          mariadb: 'INSERT INTO `users` (`user_name`,`pass_word`) VALUES (\'testuser\',\'12345\') ON DUPLICATE KEY UPDATE `user_name`=VALUES(`user_name`),`pass_word`=VALUES(`pass_word`),`updated_at`=VALUES(`updated_at`);',
          mysql: 'INSERT INTO `users` (`user_name`,`pass_word`) VALUES (\'testuser\',\'12345\') ON DUPLICATE KEY UPDATE `user_name`=VALUES(`user_name`),`pass_word`=VALUES(`pass_word`),`updated_at`=VALUES(`updated_at`);',
          sqlite: 'INSERT INTO `users` (`user_name`,`pass_word`) VALUES (\'testuser\',\'12345\') ON CONFLICT (`user_name`) DO UPDATE SET `user_name`=EXCLUDED.`user_name`,`pass_word`=EXCLUDED.`pass_word`,`updated_at`=EXCLUDED.`updated_at`;'
        });
    });
  });
});
