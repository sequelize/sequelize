'use strict';

const Support = require(__dirname + '/../support');
const expectsql = Support.expectsql;
const current = Support.sequelize;
const sql = current.dialect.QueryGenerator;

describe(Support.getTestDialectTeaser('SQL'), () => {
  if (current.dialect.name === 'postgres') {
    describe('dropSchema', () => {
      it('IF EXISTS', () => {
        expectsql(sql.dropSchema('foo'), {
          postgres: 'DROP SCHEMA IF EXISTS foo CASCADE;'
        });
      });
    });

    describe('createSchema', () => {
      it('uses IF NOT EXISTS', () => {
        expectsql(sql.createSchema('foo'), {
          postgres: 'CREATE SCHEMA IF NOT EXISTS foo;'
        });
      });
    });
  }
});
