'use strict';

const Support   = require('../support');

const expectsql = Support.expectsql;
const current   = Support.sequelize;
const sql       = current.dialect.queryGenerator;

const customSequelize = Support.createSequelizeInstance({
  schema: 'custom',
});
const customSql = customSequelize.dialect.queryGenerator;

// Notice: [] will be replaced by dialect specific tick/quote character when there is not dialect specific expectation but only a default expectation

describe(Support.getTestDialectTeaser('SQL'), () => {
  describe('removeColumn', () => {
    if (current.dialect.name !== 'sqlite') {
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
          snowflake: 'ALTER TABLE "archive"."user" DROP "email";',
        });
      });
    }

    it('defaults the schema to the one set in the Sequelize options', () => {
      expectsql(customSql.removeColumnQuery({
        tableName: 'user',
      }, 'email'), {
        ibmi: 'ALTER TABLE "custom"."user" DROP COLUMN "email"',
        mssql: 'ALTER TABLE [custom].[user] DROP COLUMN [email];',
        db2: 'ALTER TABLE "custom"."user" DROP COLUMN "email";',
        mariadb: 'ALTER TABLE `custom`.`user` DROP `email`;',
        mysql: 'ALTER TABLE `custom.user` DROP `email`;',
        postgres: 'ALTER TABLE "custom"."user" DROP COLUMN "email";',
        snowflake: 'ALTER TABLE "custom"."user" DROP "email";',
        sqlite: 'CREATE TABLE IF NOT EXISTS `user_backup` (`0` e, `1` m, `2` a, `3` i, `4` l);INSERT INTO `user_backup` SELECT `0`, `1`, `2`, `3`, `4` FROM `user`;DROP TABLE `user`;ALTER TABLE `user_backup` RENAME TO `user`;',
      });
    });
  });
});
