import { DataTypes, literal } from '@sequelize/core';
import { expectsql, sequelize } from '../../support';

describe('QueryGenerator#bulkInsertQuery', () => {
  const queryGenerator = sequelize.queryGenerator;

  const User = sequelize.define('User', {
    firstName: DataTypes.STRING,
  }, { timestamps: false });

  it('parses named replacements in literals', async () => {
    const sql = queryGenerator.bulkInsertQuery(User.table, [{
      firstName: literal(':injection'),
    }], {
      replacements: {
        injection: 'a string',
      },
    });

    expectsql(sql, {
      default: `INSERT INTO [Users] ([firstName]) VALUES ('a string');`,
      mssql: `INSERT INTO [Users] ([firstName]) VALUES (N'a string');`,
      // TODO: ibmi should be the same as `default`, since the 'returning' option is not specified
      ibmi: `SELECT * FROM FINAL TABLE (INSERT INTO "Users" ("firstName") VALUES ('a string'))`,
    });
  });
});
