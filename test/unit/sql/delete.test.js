'use strict';

const Support   = require('../support'),
  QueryTypes = require('../../../lib/query-types'),
  util = require('util'),
  _ = require('lodash'),
  expectsql = Support.expectsql,
  current   = Support.sequelize,
  Sequelize = Support.Sequelize,
  sql       = current.dialect.QueryGenerator;

// Notice: [] will be replaced by dialect specific tick/quote character when there is not dialect specific expectation but only a default expectation

describe(Support.getTestDialectTeaser('SQL'), () => {
  describe('delete', () => {
    const User = current.define('test_user', {}, {
      timestamps: false,
      schema: 'public'
    });

    describe('truncate #4306', () => {
      const options = {
        table: User.getTableName(),
        where: {},
        truncate: true,
        cascade: true,
        limit: 10,
        type: QueryTypes.BULKDELETE
      };

      it(util.inspect(options, { depth: 2 }), () => {
        return expectsql(
          sql.truncateTableQuery(
            options.table,
            options
          ), {
            postgres: 'TRUNCATE "public"."test_users" CASCADE',
            mssql: 'TRUNCATE TABLE [public].[test_users]',
            mariadb: 'TRUNCATE `public`.`test_users`',
            mysql: 'TRUNCATE `public.test_users`',
            sqlite: 'DELETE FROM `public.test_users`'
          }
        );
      });
    });

    describe('truncate with cascade and restartIdentity', () => {
      const options = {
        table: User.getTableName(),
        where: {},
        truncate: true,
        cascade: true,
        restartIdentity: true,
        limit: 10,
        type: QueryTypes.BULKDELETE
      };

      it(util.inspect(options, { depth: 2 }), () => {
        return expectsql(
          sql.truncateTableQuery(
            options.table,
            options
          ), {
            postgres: 'TRUNCATE "public"."test_users" RESTART IDENTITY CASCADE',
            mssql: 'TRUNCATE TABLE [public].[test_users]',
            mariadb: 'TRUNCATE `public`.`test_users`',
            mysql: 'TRUNCATE `public.test_users`',
            sqlite: 'DELETE FROM `public.test_users`; DELETE FROM `sqlite_sequence` WHERE `name` = \'public.test_users\';'
          }
        );
      });
    });

    describe('delete without limit', () => {
      const options = {
        table: User.getTableName(),
        where: { name: 'foo' },
        limit: null,
        type: QueryTypes.BULKDELETE
      };

      it(util.inspect(options, { depth: 2 }), () => {
        return expectsql(
          sql.deleteQuery(
            options.table,
            options.where,
            options,
            User
          ), {
            query: {
              default: 'DELETE FROM [public].[test_users] WHERE [name] = $1;',
              mysql: 'DELETE FROM `public.test_users` WHERE `name` = ?;',
              sqlite: 'DELETE FROM `public.test_users` WHERE `name` = ?1;',
              mssql: 'DELETE FROM [public].[test_users] WHERE [name] = @0; SELECT @@ROWCOUNT AS AFFECTEDROWS;'
            },
            bind: {
              default: ['foo']
            }
          });
      });
    });

    describe('delete with limit', () => {
      const options = {
        table: User.getTableName(),
        where: { name: "foo';DROP TABLE mySchema.myTable;" },
        limit: 10,
        type: QueryTypes.BULKDELETE
      };

      it(util.inspect(options, { depth: 2 }), () => {
        return expectsql(
          sql.deleteQuery(
            options.table,
            options.where,
            options,
            User
          ), {
            query: {
              postgres: 'DELETE FROM "public"."test_users" WHERE "id" IN (SELECT "id" FROM "public"."test_users" WHERE "name" = $1 LIMIT $2);',
              sqlite: 'DELETE FROM `public.test_users` WHERE rowid IN (SELECT rowid FROM `public.test_users` WHERE `name` = ?1 LIMIT ?2);',
              mssql: 'DELETE TOP(@0) FROM [public].[test_users] WHERE [name] = @1; SELECT @@ROWCOUNT AS AFFECTEDROWS;',
              mysql: 'DELETE FROM `public.test_users` WHERE `name` = ? LIMIT ?;',
              mariadb: 'DELETE FROM `public`.`test_users` WHERE `name` = ? LIMIT ?;'
            },
            bind: {
              default: ["foo';DROP TABLE mySchema.myTable;", 10],
              mssql: [10, "foo';DROP TABLE mySchema.myTable;"]
            }
          });
      });
    });

    describe('delete with limit and without model', () => {
      const options = {
        table: User.getTableName(),
        where: { name: "foo';DROP TABLE mySchema.myTable;" },
        limit: 10,
        type: QueryTypes.BULKDELETE
      };

      it(util.inspect(options, { depth: 2 }), () => {
        let query;
        try {
          query = sql.deleteQuery(
            options.table,
            options.where,
            options,
            null
          );
        } catch (err) {
          query = err;
        }

        return expectsql(
          query, {
            query: {
              postgres: new Error('Cannot LIMIT delete without a model.'),
              sqlite: 'DELETE FROM `public.test_users` WHERE rowid IN (SELECT rowid FROM `public.test_users` WHERE `name` = ?1 LIMIT ?2);',
              mssql: 'DELETE TOP(@0) FROM [public].[test_users] WHERE [name] = @1; SELECT @@ROWCOUNT AS AFFECTEDROWS;',
              mysql: 'DELETE FROM `public.test_users` WHERE `name` = ? LIMIT ?;',
              mariadb: 'DELETE FROM `public`.`test_users` WHERE `name` = ? LIMIT ?;'
            },
            bind: {
              default: ["foo';DROP TABLE mySchema.myTable;", 10],
              mssql: [10, "foo';DROP TABLE mySchema.myTable;"]
            }
          });
      });
    });

    describe('delete when the primary key has a different field name', () => {
      const User = current.define('test_user', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          field: 'test_user_id'
        }
      }, {
        timestamps: false,
        schema: 'public'
      });

      const options = {
        table: 'test_user',
        where: { 'test_user_id': 100 },
        type: QueryTypes.BULKDELETE
      };

      it(util.inspect(options, { depth: 2 }), () => {
        return expectsql(
          sql.deleteQuery(
            options.table,
            options.where,
            options,
            User
          ), {
            query: {
              default: 'DELETE FROM [test_user] WHERE [test_user_id] = $1;',
              mssql: 'DELETE FROM [test_user] WHERE [test_user_id] = @0; SELECT @@ROWCOUNT AS AFFECTEDROWS;'
            },
            bind: {
              default: [100]
            }
          });
      });
    });

    describe('delete with undefined parameter in where', () => {
      const options = {
        table: User.getTableName(),
        type: QueryTypes.BULKDELETE,
        where: { name: undefined },
        limit: null
      };

      it(util.inspect(options, { depth: 2 }), () => {
        const sqlOrError = _.attempt(
          sql.deleteQuery.bind(sql),
          options.table,
          options.where,
          options,
          User
        );
        return expectsql(sqlOrError, {
          default: new Error('WHERE parameter "name" has invalid "undefined" value')
        });
      });
    });
  });
});
