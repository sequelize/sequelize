'use strict';

const Support   = require(__dirname + '/../support'),
  DataTypes = require(__dirname + '/../../../lib/data-types'),
  expectsql = Support.expectsql,
  current   = Support.sequelize,
  sql       = current.dialect.QueryGenerator;

// Notice: [] will be replaced by dialect specific tick/quote character when there is not dialect specific expectation but only a default expectation

describe(Support.getTestDialectTeaser('SQL'), () => {
  describe('update', () => {
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
      expectsql(sql.updateQuery(User.tableName, {user_name: 'triggertest'}, {id: 2}, options, User.rawAttributes),
        {
          mssql: 'declare @tmp table ([id] INTEGER,[user_name] NVARCHAR(255));UPDATE [users] SET [user_name]=N\'triggertest\' OUTPUT INSERTED.[id],INSERTED.[user_name] into @tmp WHERE [id] = 2;select * from @tmp',
          postgres: 'UPDATE "users" SET "user_name"=\'triggertest\' WHERE "id" = 2 RETURNING *',
          default: "UPDATE `users` SET `user_name`=\'triggertest\' WHERE `id` = 2"
        });
    });


    it('Works with limit', () => {
      const User = Support.sequelize.define('User', {
        username: {
          type: DataTypes.STRING
        },
        userId: {
          type: DataTypes.INTEGER
        }
      }, {
        timestamps: false
      });

      expectsql(sql.updateQuery(User.tableName, { username: 'new.username' }, { username: 'username' }, { limit: 1 }), {
        mssql: "UPDATE TOP(1) [Users] SET [username]=N'new.username' OUTPUT INSERTED.* WHERE [username] = N'username'",
        mysql: "UPDATE `Users` SET `username`='new.username' WHERE `username` = 'username' LIMIT 1",
        sqlite: "UPDATE `Users` SET `username`='new.username' WHERE rowid IN (SELECT rowid FROM `Users` WHERE `username` = 'username' LIMIT 1)",
        default: "UPDATE [Users] SET [username]='new.username' WHERE [username] = 'username'"
      });
    });
  });
});
