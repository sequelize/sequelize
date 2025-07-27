'use strict';

const Support = require('../../support');
const { DataTypes } = require('@sequelize/core');

const expectsql = Support.expectsql;
const current = Support.sequelize;
const sql = current.dialect.queryGenerator;

// Notice: [] will be replaced by dialect specific tick/quote character when there is not dialect specific expectation but only a default expectation

describe(Support.getTestDialectTeaser('SQL'), () => {
  describe('update', () => {
    it('supports returning false', () => {
      const User = Support.sequelize.define(
        'user',
        {
          username: {
            type: DataTypes.STRING,
            field: 'user_name',
          },
        },
        {
          timestamps: false,
        },
      );

      const options = {
        returning: false,
      };
      expectsql(
        sql.updateQuery(
          User.table,
          { user_name: 'triggertest' },
          { id: 2 },
          options,
          User.getAttributes(),
        ),
        {
          query: {
            db2: 'SELECT * FROM FINAL TABLE (UPDATE "users" SET "user_name"=$sequelize_1 WHERE "id" = $sequelize_2);',
            ibmi: 'UPDATE "users" SET "user_name"=$sequelize_1 WHERE "id" = $sequelize_2',
            default: 'UPDATE [users] SET [user_name]=$sequelize_1 WHERE [id] = $sequelize_2',
          },
          bind: {
            default: { sequelize_1: 'triggertest', sequelize_2: 2 },
          },
        },
      );
    });

    it('with temp table for trigger', () => {
      const User = Support.sequelize.define(
        'user',
        {
          username: {
            type: DataTypes.STRING,
            field: 'user_name',
          },
        },
        {
          timestamps: false,
          hasTrigger: true,
        },
      );

      const options = {
        returning: true,
        hasTrigger: true,
      };
      expectsql(
        sql.updateQuery(
          User.table,
          { user_name: 'triggertest' },
          { id: 2 },
          options,
          User.getAttributes(),
        ),
        {
          query: {
            ibmi: 'UPDATE "users" SET "user_name"=$sequelize_1 WHERE "id" = $sequelize_2',
            mssql:
              'DECLARE @tmp TABLE ([id] INTEGER,[user_name] NVARCHAR(255)); UPDATE [users] SET [user_name]=$sequelize_1 OUTPUT INSERTED.[id], INSERTED.[user_name] INTO @tmp WHERE [id] = $sequelize_2; SELECT * FROM @tmp',
            sqlite3:
              'UPDATE `users` SET `user_name`=$sequelize_1 WHERE `id` = $sequelize_2 RETURNING `id`, `user_name`',
            postgres:
              'UPDATE "users" SET "user_name"=$sequelize_1 WHERE "id" = $sequelize_2 RETURNING "id", "user_name"',
            db2: 'SELECT * FROM FINAL TABLE (UPDATE "users" SET "user_name"=$sequelize_1 WHERE "id" = $sequelize_2);',
            snowflake: 'UPDATE "users" SET "user_name"=$sequelize_1 WHERE "id" = $sequelize_2',
            default: 'UPDATE `users` SET `user_name`=$sequelize_1 WHERE `id` = $sequelize_2',
          },
          bind: {
            default: { sequelize_1: 'triggertest', sequelize_2: 2 },
          },
        },
      );
    });

    it('works with limit', () => {
      const User = Support.sequelize.define(
        'User',
        {
          username: {
            type: DataTypes.STRING,
          },
          userId: {
            type: DataTypes.INTEGER,
          },
        },
        {
          timestamps: false,
        },
      );

      expectsql(
        sql.updateQuery(
          User.table,
          { username: 'new.username' },
          { username: 'username' },
          { limit: 1 },
        ),
        {
          query: {
            ibmi: 'UPDATE "Users" SET "username"=$sequelize_1 WHERE "username" = $sequelize_2',
            mssql:
              'UPDATE TOP(1) [Users] SET [username]=$sequelize_1 WHERE [username] = $sequelize_2',
            mariadb:
              'UPDATE `Users` SET `username`=$sequelize_1 WHERE `username` = $sequelize_2 LIMIT 1',
            mysql:
              'UPDATE `Users` SET `username`=$sequelize_1 WHERE `username` = $sequelize_2 LIMIT 1',
            sqlite3:
              'UPDATE `Users` SET `username`=$sequelize_1 WHERE rowid IN (SELECT rowid FROM `Users` WHERE `username` = $sequelize_2 LIMIT 1)',
            db2: 'SELECT * FROM FINAL TABLE (UPDATE (SELECT * FROM "Users" WHERE "username" = $sequelize_2 FETCH NEXT 1 ROWS ONLY) SET "username"=$sequelize_1);',
            snowflake:
              'UPDATE "Users" SET "username"=$sequelize_1 WHERE "username" = $sequelize_2 LIMIT 1',
            default: 'UPDATE [Users] SET [username]=$sequelize_1 WHERE [username] = $sequelize_2',
          },
          bind: {
            default: { sequelize_1: 'new.username', sequelize_2: 'username' },
          },
        },
      );
    });
  });
});
