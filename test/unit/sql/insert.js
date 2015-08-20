'use strict';

/* jshint -W110 */
var Support   = require(__dirname + '/../support')
  , DataTypes = require(__dirname + '/../../../lib/data-types')
  , expectsql = Support.expectsql
  , current   = Support.sequelize
  , sql       = current.dialect.QueryGenerator;

// Notice: [] will be replaced by dialect specific tick/quote character when there is not dialect specific expectation but only a default expectation

describe(Support.getTestDialectTeaser('SQL'), function() {
  describe('insert', function () {
    it('with temp table for trigger', function () {
      var User = Support.sequelize.define('user', {
        username: {
          type: DataTypes.STRING,
          field:'user_name'
        }
      },{
        timestamps:false,
        hasTrigger:true
      });

      var options = {
          returning : true,
          hasTrigger : true
      };
      expectsql(sql.insertQuery(User.tableName,{user_name: 'triggertest'},User.rawAttributes,options),
      {
        mssql:'declare @tmp table ([id] INTEGER,[user_name] NVARCHAR(255));INSERT INTO [users] ([user_name]) OUTPUT INSERTED.[id],INSERTED.[user_name] into @tmp VALUES (\'triggertest\');select * from @tmp;',
        postgres: 'INSERT INTO "users" ("user_name") VALUES (\'triggertest\') RETURNING *;',
        default: "INSERT INTO `users` (`user_name`) VALUES ('triggertest');",
      });
    });

  });

  describe('bulkCreate', function () {
    it('bulk create with onDuplicateKeyUpdate', function () {
      // Skip mssql for now, it seems broken
      if (Support.getTestDialect() === 'mssql') {
        return;
      }

      var User = Support.sequelize.define('user', {
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
      },{
        timestamps:true
      });

      expectsql(sql.bulkInsertQuery(User.tableName, [{ user_name: 'testuser', pass_word: '12345' }], { updateOnDuplicate: ['username', 'password', 'updatedAt'] }, User.rawAttributes),
      {
        default:'INSERT INTO `users` (`user_name`,`pass_word`) VALUES (\'testuser\',\'12345\');',
        postgres:'INSERT INTO "users" ("user_name","pass_word") VALUES (\'testuser\',\'12345\');',
        mysql:'INSERT INTO `users` (`user_name`,`pass_word`) VALUES (\'testuser\',\'12345\') ON DUPLICATE KEY UPDATE `user_name`=VALUES(`user_name`),`pass_word`=VALUES(`pass_word`),`updated_at`=VALUES(`updated_at`);'
      });
    });
  });
});
