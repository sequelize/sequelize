import Support from '../support.js';

const expectsql = Support.expectsql;
const current = Support.sequelize;
const sql = current.dialect.QueryGenerator;

describe(Support.getTestDialectTeaser('SQL'), () => {
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
});
