'use strict';

/* jshint -W110 */
var Support   = require(__dirname + '/../support')
  , DataTypes = require(__dirname + '/../../../lib/data-types')
  , expectsql = Support.expectsql
  , current   = Support.sequelize
  , sql       = current.dialect.QueryGenerator;


describe(Support.getTestDialectTeaser('SQL'), function() {
  describe('createTable', function () {
    describe('with enums', function () {
      var FooUser = current.define('user', {
        mood: DataTypes.ENUM('happy', 'sad')
      },{
        schema: 'foo',
        timestamps: false
      });

      it('references enum in the right schema #3171', function () {
        expectsql(sql.createTableQuery(FooUser.getTableName(), sql.attributesToSQL(FooUser.rawAttributes), { }), {
          sqlite: 'CREATE TABLE IF NOT EXISTS `foo.users` (`id` INTEGER PRIMARY KEY AUTOINCREMENT, `mood` TEXT);',
          postgres: 'CREATE TABLE IF NOT EXISTS "foo"."users" ("id"   SERIAL , "mood" "foo"."enum_users_mood", PRIMARY KEY ("id"));',
          mysql: "CREATE TABLE IF NOT EXISTS `foo.users` (`id` INTEGER NOT NULL auto_increment , `mood` ENUM('happy', 'sad'), PRIMARY KEY (`id`)) ENGINE=InnoDB;",
          mssql: "IF OBJECT_ID('[foo].[users]', 'U') IS NULL CREATE TABLE [foo].[users] ([id] INTEGER NOT NULL IDENTITY(1,1) , [mood] VARCHAR(255) CHECK (mood IN('happy', 'sad')), PRIMARY KEY ([id]));"
        });
      });
    });
  });
});

