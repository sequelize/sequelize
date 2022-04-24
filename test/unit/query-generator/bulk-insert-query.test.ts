import { DataTypes, literal } from '@sequelize/core';
import { expectsql, sequelize } from '../../support';

describe('QueryGenerator#bulkInsertQuery', () => {
  const queryGenerator = sequelize.getQueryInterface().queryGenerator;

  const User = sequelize.define('User', {
    firstName: DataTypes.STRING,
  }, { timestamps: false });

  it('parses named replacements in literals', async () => {
    const sql = queryGenerator.bulkInsertQuery(User.tableName, [{
      firstName: literal(':injection'),
    }], {
      replacements: {
        injection: 'a string',
      },
    });

    expectsql(sql, {
      default: `INSERT INTO [Users] ([firstName]) VALUES ('a string');`,
      mssql: `INSERT INTO [Users] ([firstName]) VALUES (N'a string');`,
    });
  });
});
