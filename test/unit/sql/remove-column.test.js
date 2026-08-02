import Support from '../support.js';

const expectsql = Support.expectsql;
const current = Support.sequelize;
const sql = current.dialect.QueryGenerator;

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
