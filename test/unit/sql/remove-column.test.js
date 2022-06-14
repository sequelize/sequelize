'use strict';

const Support   = require('../support');
const _ = require('lodash');

const expectsql = Support.expectsql;
const current   = Support.sequelize;
const sql       = current.dialect.queryGenerator;

const custom = _.cloneDeep(current);
custom.options.schema = 'custom';
const customSql = custom.dialect.queryGenerator;

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
          snowflake: 'ALTER TABLE "archive"."user" DROP "email";',
        });
      });
    });
  });
}

describe(`Custom Schema ${Support.getTestDialectTeaser('SQL')}`, () => {
  describe('removeColumnCustomSchema', () => {
    it('schema', () => {
      expectsql(customSql.removeColumnQuery({
        tableName: 'user',
      }, 'email'), {
        ibmi: 'ALTER TABLE "user" DROP COLUMN "email"',
        mssql: 'ALTER TABLE [user] DROP COLUMN [email];',
        db2: 'ALTER TABLE "user" DROP COLUMN "email";',
        mariadb: 'ALTER TABLE `user` DROP `email`;',
        mysql: 'ALTER TABLE `user` DROP `email`;',
        postgres: 'ALTER TABLE "custom"."user" DROP COLUMN "email";',
        snowflake: 'ALTER TABLE "user" DROP "email";',
        sqlite: 'CREATE TABLE IF NOT EXISTS `user_backup` (`0` e, `1` m, `2` a, `3` i, `4` l);INSERT INTO `user_backup` SELECT `0`, `1`, `2`, `3`, `4` FROM `user`;DROP TABLE `user`;CREATE TABLE IF NOT EXISTS `user` (`0` e, `1` m, `2` a, `3` i, `4` l);INSERT INTO `user` SELECT `0`, `1`, `2`, `3`, `4` FROM `user_backup`;DROP TABLE `user_backup`;',
      });
    });
  });
});
