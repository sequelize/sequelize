'use strict';

const Support   = require('../support'),
  DataTypes = require('../../../lib/data-types'),
  expectsql = Support.expectsql,
  current   = Support.sequelize,
  sql       = current.dialect.queryGenerator;

// Notice: [] will be replaced by dialect specific tick/quote character when there is not dialect specific expectation but only a default expectation

describe(Support.getTestDialectTeaser('SQL'), () => {
  describe('update', () => {
    it('supports returning false', () => {
      const User = Support.sequelize.define('user', {
        username: {
          type: DataTypes.STRING,
          field: 'user_name'
        }
      }, {
        timestamps: false
      });

      const options = {
        returning: false
      };
      expectsql(sql.updateQuery(User.tableName, { user_name: 'triggertest' }, { id: 2 }, options, User.rawAttributes),
        {
          query: {
            default: 'UPDATE [users] SET [user_name]=$1 WHERE [id] = $2'
          },
          bind: {
            default: ['triggertest', 2]
          }
        });
    });

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
      expectsql(sql.updateQuery(User.tableName, { user_name: 'triggertest' }, { id: 2 }, options, User.rawAttributes),
        {
          query: {
            ibmi: 'UPDATE "users" SET "user_name"=? WHERE "id" = ?',
            mssql: 'DECLARE @tmp TABLE ([id] INTEGER,[user_name] NVARCHAR(255)); UPDATE [users] SET [user_name]=$1 OUTPUT INSERTED.[id],INSERTED.[user_name] INTO @tmp WHERE [id] = $2; SELECT * FROM @tmp',
            postgres: 'UPDATE "users" SET "user_name"=$1 WHERE "id" = $2 RETURNING "id","user_name"',
            default: 'UPDATE `users` SET `user_name`=$1 WHERE `id` = $2'
          },
          bind: {
            default: ['triggertest', 2]
          }
        });
    });

    it('works with limit', () => {
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
        query: {
          ibmi: 'UPDATE "Users" SET "username"=? WHERE "username" = ?',
          mssql: 'UPDATE TOP(1) [Users] SET [username]=$1 WHERE [username] = $2',
          mariadb: 'UPDATE `Users` SET `username`=$1 WHERE `username` = $2 LIMIT 1',
          mysql: 'UPDATE `Users` SET `username`=$1 WHERE `username` = $2 LIMIT 1',
          sqlite: 'UPDATE `Users` SET `username`=$1 WHERE rowid IN (SELECT rowid FROM `Users` WHERE `username` = $2 LIMIT 1)',
          default: 'UPDATE [Users] SET [username]=$1 WHERE [username] = $2'
        },
        bind: {
          default: ['new.username', 'username']
        }
      });
    });
  });
});
