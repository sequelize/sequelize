'use strict';

var Support   = require(__dirname + '/../support')
  , expectsql = Support.expectsql
  , current   = Support.sequelize
  , sql       = current.dialect.QueryGenerator
  , current = Support.sequelize;

// Notice: [] will be replaced by dialect specific tick/quote character when there is not dialect specific expectation but only a default expectation

suite(Support.getTestDialectTeaser('SQL'), function() {
  suite('removeColumn', function () {
    test('schema', function () {
      expectsql(sql.removeColumnQuery({
        schema: 'archive',
        tableName: 'user'
      }, 'email'), {
        default: "ALTER TABLE [archive].[user] DROP COLUMN [email];",
        mysql: "ALTER TABLE `archive.user` DROP `email`;"
      });
    });
  });
});