'use strict';

const Support = require(__dirname + '/../support'),
  expectsql = Support.expectsql,
  current = Support.sequelize,
  sql = current.dialect.QueryGenerator;

describe(Support.getTestDialectTeaser('SQL'), () => {
  describe('removeColumn', () => {
    it('schema', () => {
      expectsql(
        sql.removeColumnQuery(
          {
            schema: 'archive',
            tableName: 'user'
          },
          'email'
        ),
        {
          postgres: 'ALTER TABLE "archive"."user" DROP COLUMN "email";'
        }
      );
    });
  });
});
