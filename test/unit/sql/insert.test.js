'use strict';

const Support   = require(__dirname + '/../support'),
  DataTypes = require(__dirname + '/../../../lib/data-types'),
  expectsql = Support.expectsql,
  current   = Support.sequelize,
  sql       = current.dialect.QueryGenerator;

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
      expectsql(sql.insertQuery(User.tableName, {user_name: 'triggertest'}, User.rawAttributes, options),
        {
          mssql: 'declare @tmp table ([id] INTEGER,[user_name] NVARCHAR(255));INSERT INTO [users] ([user_name]) OUTPUT INSERTED.[id],INSERTED.[user_name] into @tmp VALUES (N\'triggertest\');select * from @tmp;',
          postgres: 'INSERT INTO "users" ("user_name") VALUES (\'triggertest\') RETURNING *;',
          default: "INSERT INTO `users` (`user_name`) VALUES ('triggertest');"
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

      expectsql(timezoneSequelize.dialect.QueryGenerator.insertQuery(User.tableName, {date: new Date(Date.UTC(2015, 0, 20))}, User.rawAttributes, {}),
        {
          postgres: 'INSERT INTO "users" ("date") VALUES (\'2015-01-20 01:00:00.000 +01:00\');',
          sqlite: 'INSERT INTO `users` (`date`) VALUES (\'2015-01-20 00:00:00.000 +00:00\');',
          mssql: 'INSERT INTO [users] ([date]) VALUES (N\'2015-01-20 01:00:00.000 +01:00\');',
          mysql: "INSERT INTO `users` (`date`) VALUES ('2015-01-20 01:00:00');"
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

      expectsql(timezoneSequelize.dialect.QueryGenerator.insertQuery(User.tableName, {date: new Date(Date.UTC(2015, 0, 20, 1, 2, 3, 89))}, User.rawAttributes, {}),
        {
          postgres: 'INSERT INTO "users" ("date") VALUES (\'2015-01-20 02:02:03.089 +01:00\');',
          sqlite: 'INSERT INTO `users` (`date`) VALUES (\'2015-01-20 01:02:03.089 +00:00\');',
          mssql: 'INSERT INTO [users] ([date]) VALUES (N\'2015-01-20 02:02:03.089 +01:00\');',
          mysql: "INSERT INTO `users` (`date`) VALUES ('2015-01-20 02:02:03.089');"
        });
    });
  });

  describe('bulkCreate', () => {
    it('bulk create with onDuplicateKeyUpdate', () => {
      const User = Support.sequelize.define('user', {
        username: {
          type: DataTypes.STRING,
          field: 'user_name'
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

      expectsql(sql.bulkInsertQuery(User.tableName, [{ user_name: 'testuser', pass_word: '12345' }], { updateOnDuplicate: ['user_name', 'pass_word', 'updated_at'] }, User.fieldRawAttributesMap),
        {
          default: 'INSERT INTO `users` (`user_name`,`pass_word`) VALUES (\'testuser\',\'12345\');',
          postgres: 'INSERT INTO "users" ("user_name","pass_word") VALUES (\'testuser\',\'12345\');',
          mssql: 'INSERT INTO [users] ([user_name],[pass_word]) VALUES (N\'testuser\',N\'12345\');',
          mysql: 'INSERT INTO `users` (`user_name`,`pass_word`) VALUES (\'testuser\',\'12345\') ON DUPLICATE KEY UPDATE `user_name`=VALUES(`user_name`),`pass_word`=VALUES(`pass_word`),`updated_at`=VALUES(`updated_at`);'
        });
    });
  });
});
