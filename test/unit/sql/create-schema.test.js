'use strict';

const Support = require('../support');
const expectsql = Support.expectsql;
const current = Support.sequelize;
const sql = current.dialect.queryGenerator;

describe(Support.getTestDialectTeaser('SQL'), () => {
  if (current.dialect.name === 'postgres') {
    describe('dropSchema', () => {
      it('IF EXISTS', () => {
        expectsql(sql.dropSchema('foo'), {
          postgres: 'DROP SCHEMA IF EXISTS "foo" CASCADE;'
        });
      });
    });

    describe('createSchema', () => {
      before(function() {
        this.version = current.options.databaseVersion;
      });

      after(function() {
        current.options.databaseVersion = this.version;
      });

      it('9.2.0 or above', () => {
        current.options.databaseVersion = '9.2.0';
        expectsql(sql.createSchema('foo'), {
          postgres: 'CREATE SCHEMA IF NOT EXISTS "foo";'
        });
      });

      it('below 9.2.0', () => {
        current.options.databaseVersion = '9.0.0';
        expectsql(sql.createSchema('foo'), {
          postgres: 'CREATE SCHEMA "foo";'
        });
      });
    });
  }
});
