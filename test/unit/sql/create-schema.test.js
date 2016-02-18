'use strict';

var Support   = require(__dirname + '/../support')
  , expectsql = Support.expectsql
  , current   = Support.sequelize
  , sql       = current.dialect.QueryGenerator;

describe(Support.getTestDialectTeaser('SQL'), function() {
  if (current.dialect.name === 'postgres') {
    describe('dropSchema', function () {
      test('IF EXISTS', function () {
        expectsql(sql.dropSchema('foo'), {
          postgres: 'DROP SCHEMA IF EXISTS foo CASCADE;'
        });
      });
    });
  }
});
