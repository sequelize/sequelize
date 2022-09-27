'use strict';

const Support   = require('../support');

const expectsql = Support.expectsql;
const current   = Support.sequelize;
const sql       = current.dialect.queryGenerator;

const customSequelize = Support.createSequelizeInstance({
  schema: 'custom'
});
const customSql = customSequelize.dialect.queryGenerator;

// Notice: [] will be replaced by dialect specific tick/quote character when there is not dialect specific expectation but only a default expectation

describe(Support.getTestDialectTeaser('SQL'), () => {
  describe('removeColumn', () => {
    if (current.dialect.name !== 'sqlite') {
      it('schema', () => {
        expectsql(sql.removeColumnQuery({
          schema: 'archive',
          tableName: 'user'
        }, 'email'), {
          mssql: 'ALTER TABLE [archive].[user] DROP COLUMN [email];',
          db2: 'ALTER TABLE "archive"."user" DROP COLUMN "email";',
          mariadb: 'ALTER TABLE `archive`.`user` DROP `email`;',
          mysql: 'ALTER TABLE `archive.user` DROP `email`;',
          postgres: 'ALTER TABLE "archive"."user" DROP COLUMN "email";',
          snowflake: 'ALTER TABLE "archive"."user" DROP "email";',
          oracle: 'ALTER TABLE "archive"."user" DROP COLUMN "email";'
        });
      });
    }

    it('defaults the schema to the one set in the Sequelize options', () => {
      expectsql(customSql.removeColumnQuery({
        tableName: 'user'
      }, 'email'), {
        mssql: 'ALTER TABLE [user] DROP COLUMN [email];',
        db2: 'ALTER TABLE "user" DROP COLUMN "email";',
        mariadb: 'ALTER TABLE `user` DROP `email`;',
        mysql: 'ALTER TABLE `user` DROP `email`;',
        postgres: 'ALTER TABLE "custom"."user" DROP COLUMN "email";',
        snowflake: 'ALTER TABLE "user" DROP "email";',
        sqlite: 'CREATE TABLE IF NOT EXISTS `user_backup` (`0` e, `1` m, `2` a, `3` i, `4` l);INSERT INTO `user_backup` SELECT `0`, `1`, `2`, `3`, `4` FROM `user`;DROP TABLE `user`;CREATE TABLE IF NOT EXISTS `user` (`0` e, `1` m, `2` a, `3` i, `4` l);INSERT INTO `user` SELECT `0`, `1`, `2`, `3`, `4` FROM `user_backup`;DROP TABLE `user_backup`;',
        oracle: 'ALTER TABLE "user" DROP COLUMN "email";'
      });
    });
  });
});
