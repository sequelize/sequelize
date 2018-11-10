'use strict';

const Support   = require(__dirname + '/../support'),
  DataTypes = require(__dirname + '/../../../lib/data-types'),
  expectsql = Support.expectsql,
  current   = Support.sequelize,
  sql       = current.dialect.QueryGenerator,
  _         = require('lodash');

describe(Support.getTestDialectTeaser('SQL'), () => {
  describe('createTable', () => {
    const FooUser = current.define('user', {
      mood: DataTypes.ENUM('happy', 'sad')
    }, {
      schema: 'foo',
      timestamps: false
    });
    describe('with enums', () => {
      it('references enum in the right schema #3171', () => {
        expectsql(sql.createTableQuery(FooUser.getTableName(), sql.attributesToSQL(FooUser.rawAttributes), { }), {
          sqlite: 'CREATE TABLE IF NOT EXISTS `foo.users` (`id` INTEGER PRIMARY KEY AUTOINCREMENT, `mood` TEXT);',
          postgres: 'CREATE TABLE IF NOT EXISTS "foo"."users" ("id"   SERIAL , "mood" "foo"."enum_users_mood", PRIMARY KEY ("id"));',
          mysql: "CREATE TABLE IF NOT EXISTS `foo.users` (`id` INTEGER NOT NULL auto_increment , `mood` ENUM('happy', 'sad'), PRIMARY KEY (`id`)) ENGINE=InnoDB;",
          mssql: "IF OBJECT_ID('[foo].[users]', 'U') IS NULL CREATE TABLE [foo].[users] ([id] INTEGER NOT NULL IDENTITY(1,1) , [mood] VARCHAR(255) CHECK ([mood] IN(N'happy', N'sad')), PRIMARY KEY ([id]));"
        });
      });
    });
    if (current.dialect.name === 'postgres') {
      describe('IF NOT EXISTS version check', () => {
        const modifiedSQL = _.clone(sql);
        const createTableQueryModified = sql.createTableQuery.bind(modifiedSQL);
        it('it will not have IF NOT EXISTS for version 9.0 or below', () => {
          modifiedSQL.sequelize.options.databaseVersion = '9.0.0';
          expectsql(createTableQueryModified(FooUser.getTableName(), sql.attributesToSQL(FooUser.rawAttributes), { }), {
            postgres: 'CREATE TABLE "foo"."users" ("id"   SERIAL , "mood" "foo"."enum_users_mood", PRIMARY KEY ("id"));'
          });
        });
        it('it will have IF NOT EXISTS for version 9.1 or above', () => {
          modifiedSQL.sequelize.options.databaseVersion = '9.1.0';
          expectsql(createTableQueryModified(FooUser.getTableName(), sql.attributesToSQL(FooUser.rawAttributes), { }), {
            postgres: 'CREATE TABLE IF NOT EXISTS "foo"."users" ("id"   SERIAL , "mood" "foo"."enum_users_mood", PRIMARY KEY ("id"));'
          });
        });
        it('it will have IF NOT EXISTS for default version', () => {
          modifiedSQL.sequelize.options.databaseVersion = 0;
          expectsql(createTableQueryModified(FooUser.getTableName(), sql.attributesToSQL(FooUser.rawAttributes), { }), {
            postgres: 'CREATE TABLE IF NOT EXISTS "foo"."users" ("id"   SERIAL , "mood" "foo"."enum_users_mood", PRIMARY KEY ("id"));'
          });
        });
      });

      describe('Attempt to use different lodash template settings', () => {
        before(() => {
          // make handlebars
          _.templateSettings.evaluate = /{{([\s\S]+?)}}/g;
          _.templateSettings.interpolate = /{{=([\s\S]+?)}}/g;
          _.templateSettings.escape = /{{-([\s\S]+?)}}/g;
        });

        after(() => {
          // reset
          const __ = require('lodash').runInContext();
          _.templateSettings.evaluate = __.templateSettings.evaluate;
          _.templateSettings.interpolate = __.templateSettings.interpolate;
          _.templateSettings.escape = __.templateSettings.escape;
        });

        it('it should be a okay!', () => {
          expectsql(sql.createTableQuery(FooUser.getTableName(), sql.attributesToSQL(FooUser.rawAttributes), {
            comment: 'This is a test of the lodash template settings.'
          }), {
            postgres: 'CREATE TABLE IF NOT EXISTS "foo"."users" ("id"   SERIAL , "mood" "foo"."enum_users_mood", PRIMARY KEY ("id")); COMMENT ON TABLE "foo"."users" IS \'This is a test of the lodash template settings.\';'
          });
        });
      });
    }
  });
});
