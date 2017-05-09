'use strict';

const Support   = require(__dirname + '/../support'),
  expectsql = Support.expectsql,
  current   = Support.sequelize,
  sql       = current.dialect.QueryGenerator;

describe(Support.getTestDialectTeaser('SQL'), () => {
  if (current.dialect.name === 'postgres') {
    describe('dropSchema', () => {
      test('IF EXISTS', () => {
        expectsql(sql.dropSchema('foo'), {
          postgres: 'DROP SCHEMA IF EXISTS foo CASCADE;'
        });
      });
    });
  }
});
