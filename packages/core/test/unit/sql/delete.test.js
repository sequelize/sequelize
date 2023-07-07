'use strict';

const Support   = require('../../support');
const { QueryTypes, DataTypes } = require('@sequelize/core');
const util = require('node:util');

const expectsql = Support.expectsql;
const current   = Support.sequelize;
const sql       = current.dialect.queryGenerator;

// Notice: [] will be replaced by dialect specific tick/quote character when there is not dialect specific expectation but only a default expectation

describe(Support.getTestDialectTeaser('SQL'), () => {
  describe('delete', () => {
    const User = current.define('test_user', {}, {
      timestamps: false,
      schema: 'public',
    });

    describe('truncate #4306', () => {
      const options = {
        table: User.getTableName(),
        where: {},
        truncate: true,
        cascade: true,
        limit: 10,
        type: QueryTypes.BULKDELETE,
      };

      it(util.inspect(options, { depth: 2 }), () => {
        return expectsql(
          sql.truncateTableQuery(
            options.table,
            options,
          ), {
            ibmi: 'TRUNCATE TABLE "public"."test_users" IMMEDIATE',
            postgres: 'TRUNCATE "test_users" CASCADE',
            mssql: 'TRUNCATE TABLE [public].[test_users]',
            mariadb: 'TRUNCATE `public`.`test_users`',
            mysql: 'TRUNCATE `public`.`test_users`',
            db2: 'TRUNCATE TABLE "public"."test_users" IMMEDIATE',
            sqlite: 'DELETE FROM `public.test_users`',
            snowflake: 'TRUNCATE "public"."test_users"',
          },
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
        type: QueryTypes.BULKDELETE,
      };

      it(util.inspect(options, { depth: 2 }), () => {
        return expectsql(
          sql.truncateTableQuery(
            options.table,
            options,
          ), {
            ibmi: 'TRUNCATE TABLE "public"."test_users" IMMEDIATE',
            postgres: 'TRUNCATE "test_users" RESTART IDENTITY CASCADE',
            mssql: 'TRUNCATE TABLE [public].[test_users]',
            mariadb: 'TRUNCATE `public`.`test_users`',
            mysql: 'TRUNCATE `public`.`test_users`',
            db2: 'TRUNCATE TABLE "public"."test_users" IMMEDIATE',
            sqlite: 'DELETE FROM `public.test_users`; DELETE FROM `sqlite_sequence` WHERE `name` = `public.test_users`;',
            snowflake: 'TRUNCATE "public"."test_users"',
          },
        );
      });
    });

    describe('delete without limit', () => {
      const options = {
        table: User.getTableName(),
        where: { name: 'foo' },
        limit: null,
        type: QueryTypes.BULKDELETE,
      };

      it(util.inspect(options, { depth: 2 }), () => {
        return expectsql(
          sql.deleteQuery(
            options.table,
            options.where,
            options,
            User,
          ), {
            default: `DELETE FROM [public].[test_users] WHERE [name] = 'foo'`,
            postgres: `DELETE FROM "test_users" WHERE "name" = 'foo'`,
            mariadb: 'DELETE FROM `public`.`test_users` WHERE `name` = \'foo\'',
            sqlite: 'DELETE FROM `public.test_users` WHERE `name` = \'foo\'',
            db2: `DELETE FROM "public"."test_users" WHERE "name" = 'foo'`,
            mssql: `DELETE FROM [public].[test_users] WHERE [name] = N'foo'; SELECT @@ROWCOUNT AS AFFECTEDROWS;`,
            snowflake: `DELETE FROM "public"."test_users" WHERE "name" = 'foo'`,
            ibmi: `DELETE FROM "public"."test_users" WHERE "name" = 'foo'`,
          },
        );
      });
    });

    describe('delete with limit', () => {
      const options = {
        table: User.getTableName(),
        where: { name: 'foo\';DROP TABLE mySchema.myTable;' },
        limit: 10,
        type: QueryTypes.BULKDELETE,
      };

      it(util.inspect(options, { depth: 2 }), () => {
        return expectsql(
          sql.deleteQuery(
            options.table,
            options.where,
            options,
            User,
          ), {
            default: `DELETE FROM [public].[test_users] WHERE [name] = 'foo\\';DROP TABLE mySchema.myTable;' LIMIT 10`,
            ibmi: `DELETE FROM "public"."test_users" WHERE "name" = 'foo'';DROP TABLE mySchema.myTable;' FETCH NEXT 10 ROWS ONLY`,
            postgres: `DELETE FROM "test_users" WHERE "id" IN (SELECT "id" FROM "test_users" WHERE "name" = 'foo'';DROP TABLE mySchema.myTable;' LIMIT 10)`,
            sqlite: 'DELETE FROM `public.test_users` WHERE rowid IN (SELECT rowid FROM `public.test_users` WHERE `name` = \'foo\'\';DROP TABLE mySchema.myTable;\' LIMIT 10)',
            mssql: `DELETE TOP(10) FROM [public].[test_users] WHERE [name] = N'foo'';DROP TABLE mySchema.myTable;'; SELECT @@ROWCOUNT AS AFFECTEDROWS;`,
            db2: `DELETE FROM "public"."test_users" WHERE "name" = 'foo'';DROP TABLE mySchema.myTable;' FETCH NEXT 10 ROWS ONLY`,
            snowflake: `DELETE FROM "public"."test_users" WHERE "id" IN (SELECT "id" FROM "public"."test_users" WHERE "name" = 'foo'';DROP TABLE mySchema.myTable;' LIMIT 10)`,
          },
        );
      });
    });

    describe('delete with limit and without model', () => {
      const options = {
        table: User.getTableName(),
        where: { name: 'foo\';DROP TABLE mySchema.myTable;' },
        limit: 10,
        type: QueryTypes.BULKDELETE,
      };

      it(util.inspect(options, { depth: 2 }), () => {
        let query;
        try {
          query = sql.deleteQuery(
            options.table,
            options.where,
            options,
            null,
          );
        } catch (error) {
          query = error;
        }

        return expectsql(
          query, {
            default: `DELETE FROM [public].[test_users] WHERE [name] = 'foo\\';DROP TABLE mySchema.myTable;' LIMIT 10`,
            ibmi: 'DELETE FROM "public"."test_users" WHERE "name" = \'foo\'\';DROP TABLE mySchema.myTable;\' FETCH NEXT 10 ROWS ONLY',
            postgres: new Error('Cannot LIMIT delete without a model.'),
            sqlite: 'DELETE FROM `public.test_users` WHERE rowid IN (SELECT rowid FROM `public.test_users` WHERE `name` = \'foo\'\';DROP TABLE mySchema.myTable;\' LIMIT 10)',
            mssql: 'DELETE TOP(10) FROM [public].[test_users] WHERE [name] = N\'foo\'\';DROP TABLE mySchema.myTable;\'; SELECT @@ROWCOUNT AS AFFECTEDROWS;',
            db2: 'DELETE FROM "public"."test_users" WHERE "name" = \'foo\'\';DROP TABLE mySchema.myTable;\' FETCH NEXT 10 ROWS ONLY',
            snowflake: new Error('Cannot LIMIT delete without a model.'),
          },
        );
      });
    });

    describe('delete when the primary key has a different field name', () => {
      const User = current.define('test_user', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          field: 'test_user_id',
        },
      }, {
        timestamps: false,
        schema: 'public',
      });

      const options = {
        table: 'test_user',
        where: { test_user_id: 100 },
        type: QueryTypes.BULKDELETE,
      };

      it(util.inspect(options, { depth: 2 }), () => {
        return expectsql(
          sql.deleteQuery(
            options.table,
            options.where,
            options,
            User,
          ), {
            ibmi: 'DELETE FROM "test_user" WHERE "test_user_id" = 100',
            postgres: 'DELETE FROM "test_user" WHERE "test_user_id" = 100',
            sqlite: 'DELETE FROM `test_user` WHERE `test_user_id` = 100',
            mssql: 'DELETE FROM [test_user] WHERE [test_user_id] = 100; SELECT @@ROWCOUNT AS AFFECTEDROWS;',
            snowflake: 'DELETE FROM "test_user" WHERE "test_user_id" = 100',
            default: 'DELETE FROM [test_user] WHERE [test_user_id] = 100',
          },
        );
      });
    });

    describe('delete with undefined parameter in where', () => {
      const options = {
        table: User.getTableName(),
        type: QueryTypes.BULKDELETE,
        where: { name: undefined },
        limit: null,
      };

      it(util.inspect(options, { depth: 2 }), () => {
        return expectsql(() => sql.deleteQuery(options.table, options.where, options, User), {
          default: new Error(`Invalid value received for the "where" option. Refer to the sequelize documentation to learn which values the "where" option accepts.
Value: { name: undefined }
Caused by: "undefined" cannot be escaped`),
        });
      });
    });
  });
});
