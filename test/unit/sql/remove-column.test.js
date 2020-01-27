'use strict';

const Support   = require('../support'),
  expectsql = Support.expectsql,
  current   = Support.sequelize,
  sql       = current.dialect.QueryGenerator;

// Notice: [] will be replaced by dialect specific tick/quote character when there is not dialect specific expectation but only a default expectation

if (current.dialect.name !== 'sqlite') {
  describe(Support.getTestDialectTeaser('SQL'), () => {
    describe('removeColumn', () => {
      it('schema', () => {
        expectsql(sql.removeColumnQuery({
          schema: 'archive',
          tableName: 'user'
        }, 'email'), {
          mssql: 'ALTER TABLE [archive].[user] DROP COLUMN [email];',
          mariadb: 'ALTER TABLE `archive`.`user` DROP `email`;',
          mysql: 'ALTER TABLE `archive.user` DROP `email`;',
          postgres: 'ALTER TABLE "archive"."user" DROP COLUMN "email";'
        });
      });

      describe('with if exists option', () => {
        it('schema', () => {
          expectsql(sql.removeColumnQuery({
            schema: 'archive',
            tableName: 'user'
          }, 'email', { mustExist: false }), {
            mssql: 'ALTER TABLE [archive].[user] DROP COLUMN [email];',
            mariadb: 'ALTER TABLE `archive`.`user` DROP `email`;',
            mysql: 'ALTER TABLE `archive.user` DROP `email`;',
            postgres: 'ALTER TABLE "archive"."user" DROP COLUMN IF EXISTS "email";'
          });
        });
      });
    });
  });
}
