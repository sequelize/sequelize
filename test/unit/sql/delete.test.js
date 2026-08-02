import Support from '../support.js';
import { inspect } from 'node:util';

const expectsql = Support.expectsql;
const current = Support.sequelize;
const Sequelize = Support.Sequelize;
const sql = current.dialect.QueryGenerator;

// Notice: [] will be replaced by dialect specific tick/quote character when there is not dialect specific expectation but only a default expectation

describe(Support.getTestDialectTeaser('SQL'), () => {
  describe('delete', () => {
    const User = current.define(
      'test_user',
      {},
      {
        timestamps: false,
        schema: 'public'
      }
    );

    describe('truncate #4306', () => {
      const options = {
        table: User.getTableName(),
        where: {},
        truncate: true,
        cascade: true,
        limit: 10
      };

      it(inspect(options, { depth: 0, maxArrayLength: 5, breakLength: Infinity }), () => {
        return expectsql(sql.deleteQuery(options.table, options.where, options, User), {
          postgres: 'TRUNCATE "public"."test_users" CASCADE'
        });
      });
    });

    describe('truncate with cascade and restartIdentity', () => {
      const options = {
        table: User.getTableName(),
        where: {},
        truncate: true,
        cascade: true,
        restartIdentity: true,
        limit: 10
      };

      it(inspect(options, { depth: 0, maxArrayLength: 5, breakLength: Infinity }), () => {
        return expectsql(sql.deleteQuery(options.table, options.where, options, User), {
          postgres: 'TRUNCATE "public"."test_users" RESTART IDENTITY CASCADE'
        });
      });
    });

    describe('delete without limit', () => {
      const options = {
        table: User.getTableName(),
        where: { name: 'foo' },
        limit: null
      };

      it(inspect(options, { depth: 0, maxArrayLength: 5, breakLength: Infinity }), () => {
        return expectsql(sql.deleteQuery(options.table, options.where, options, User), {
          default: "DELETE FROM [public.test_users] WHERE `name` = 'foo'",
          postgres: 'DELETE FROM "public"."test_users" WHERE "name" = \'foo\''
        });
      });
    });

    describe('delete with limit', () => {
      const options = {
        table: User.getTableName(),
        where: { name: "foo';DROP TABLE mySchema.myTable;" },
        limit: 10
      };

      it(inspect(options, { depth: 0, maxArrayLength: 5, breakLength: Infinity }), () => {
        return expectsql(sql.deleteQuery(options.table, options.where, options, User), {
          postgres:
            'DELETE FROM "public"."test_users" WHERE "id" IN (SELECT "id" FROM "public"."test_users" WHERE "name" = \'foo\'\';DROP TABLE mySchema.myTable;\' LIMIT 10)',
          default: "DELETE FROM [public.test_users] WHERE `name` = 'foo\\';DROP TABLE mySchema.myTable;' LIMIT 10"
        });
      });
    });

    describe('delete with limit and without model', () => {
      const options = {
        table: User.getTableName(),
        where: { name: "foo';DROP TABLE mySchema.myTable;" },
        limit: 10
      };

      it(inspect(options, { depth: 0, maxArrayLength: 5, breakLength: Infinity }), () => {
        let query;
        try {
          query = sql.deleteQuery(options.table, options.where, options, null);
        } catch (err) {
          query = err;
        }

        return expectsql(query, {
          postgres: new Error('Cannot LIMIT delete without a model.'),
          default: "DELETE FROM [public.test_users] WHERE `name` = 'foo\\';DROP TABLE mySchema.myTable;' LIMIT 10"
        });
      });
    });

    describe('delete when the primary key has a different field name', () => {
      const User = current.define(
        'test_user',
        {
          id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            field: 'test_user_id'
          }
        },
        {
          timestamps: false,
          schema: 'public'
        }
      );

      const options = {
        table: 'test_user',
        where: { test_user_id: 100 }
      };

      it(inspect(options, { depth: 0, maxArrayLength: 5, breakLength: Infinity }), () => {
        return expectsql(sql.deleteQuery(options.table, options.where, options, User), {
          postgres:
            'DELETE FROM "test_user" WHERE "test_user_id" IN (SELECT "test_user_id" FROM "test_user" WHERE "test_user_id" = 100 LIMIT 1)',
          default: 'DELETE FROM [test_user] WHERE [test_user_id] = 100 LIMIT 1'
        });
      });
    });
  });
});
