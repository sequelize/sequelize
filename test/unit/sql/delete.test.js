'use strict';

/* jshint -W110 */
var Support   = require(__dirname + '/../support')
  , util = require('util')
  , expectsql = Support.expectsql
  , current   = Support.sequelize
  , Sequelize = Support.Sequelize
  , sql       = current.dialect.QueryGenerator;

// Notice: [] will be replaced by dialect specific tick/quote character when there is not dialect specific expectation but only a default expectation

suite(Support.getTestDialectTeaser('SQL'), function() {
  suite('delete', function () {

    suite('delete when the primary key has a different field name', function () {

      var User = current.define('test_user', {
        id: {
          type:       Sequelize.INTEGER,
          primaryKey: true,
          field:      "test_user_id",
        }
      }, { freezeTableName: true, timestamps:false });

      var options = {
        table: 'test_user',
        where: { 'test_user_id': 100 }
      };

      test(util.inspect(options, {depth: 2}), function () {
        return expectsql(
          sql.deleteQuery(
            options.table,
            options.where,
            options,
            User
          ), {
            postgres: 'DELETE FROM "public"."test_user" WHERE "test_user_id" IN (SELECT "test_user_id" FROM "public"."test_user" WHERE "test_user_id" = 100 LIMIT 1)',
            sqlite:   'DELETE FROM `test_user` WHERE `test_user_id` = 100',
            mssql:    'DELETE TOP(1) FROM [test_user] WHERE [test_user_id] = 100; SELECT @@ROWCOUNT AS AFFECTEDROWS;',
            default:  'DELETE FROM [test_user] WHERE [test_user_id] = 100 LIMIT 1'
          }
        );
      });

    });

    suite('include the correct schema during bulk delete when appropriate', function () {

      var User = current.define('test_user', {
        id: {
          type:       Sequelize.INTEGER,
          primaryKey: true,
          field:      "test_user_id",
        }
      }, {
        schema: 'web',
        freezeTableName: true,
        timestamps:false
      });

      var options = {
        table: 'test_user',
        schema: 'web',
        where: {
          'test_user_id': 100
        }
      };

      test(util.inspect(options, {depth: 2}), function () {
        return expectsql(
          sql.deleteQuery(
            options.table,
            options.where,
            options,
            User
          ), {
            postgres: 'DELETE FROM "web"."test_user" WHERE "test_user_id" IN (SELECT "test_user_id" FROM "web"."test_user" WHERE "test_user_id" = 100 LIMIT 1)',
            sqlite:   'DELETE FROM `test_user` WHERE `test_user_id` = 100',
            mssql:    'DELETE TOP(1) FROM [test_user] WHERE [test_user_id] = 100; SELECT @@ROWCOUNT AS AFFECTEDROWS;',
            default:  'DELETE FROM [test_user] WHERE [test_user_id] = 100 LIMIT 1'
          }
        );
      });

    });

    suite('include the correct schema during bulk delete + truncate when appropriate', function () {

      var User = current.define('test_user', {
        id: {
          type:       Sequelize.INTEGER,
          primaryKey: true,
          field:      "test_user_id",
        }
      }, {
        freezeTableName: true,
        timestamps:false
      });

      var options = {
        table: 'test_user',
        truncate: true
      };

      test(util.inspect(options, {depth: 2}), function () {
        return expectsql(
          sql.deleteQuery(
            options.table,
            options.where,
            options,
            User
          ), {
            postgres: 'TRUNCATE "public"."test_user"',
            sqlite:   'TRUNCATE `test_user`',
            default:  'TRUNCATE [test_user]'
          }
        );
      });

    });
  });
});
