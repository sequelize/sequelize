'use strict';

const Support   = require('../support');

const expectsql = Support.expectsql;
const current   = Support.sequelize;
const sql       = current.dialect.queryGenerator;

// Notice: [] will be replaced by dialect specific tick/quote character when there is not dialect specific expectation but only a default expectation

if (current.dialect.name !== 'sqlite') {
  describe(Support.getTestDialectTeaser('SQL'), () => {
    describe('removeColumn', () => {
      it('schema', () => {
        expectsql(sql.removeColumnQuery({
          schema: 'archive',
          tableName: 'user',
        }, 'email'), {
          ibmi: 'ALTER TABLE "archive"."user" DROP COLUMN "email"',
          mssql: 'ALTER TABLE [archive].[user] DROP COLUMN [email];',
          db2: 'ALTER TABLE "archive"."user" DROP COLUMN "email";',
          mariadb: 'ALTER TABLE `archive`.`user` DROP `email`;',
          mysql: 'ALTER TABLE `archive.user` DROP `email`;',
          postgres: 'ALTER TABLE "archive"."user" DROP COLUMN "email";',
          yugabyte: 'ALTER TABLE "archive"."user" DROP COLUMN "email";',
          snowflake: 'ALTER TABLE "archive"."user" DROP "email";',
        });
      });
    });
  });
}
