const { DataTypes } = require('sequelize');
const sinon = require('sinon');
const { expectsql, sequelize } = require('../../support');
const { stubQueryRun } = require('./stub-query-run');

describe('QueryInterface#rawSelect', () => {
  const User = sequelize.define('User', {
    firstName: DataTypes.STRING
  }, { timestamps: false });

  afterEach(() => {
    sinon.restore();
  });

  // you'll find more replacement tests in query-generator tests
  it('does not parse user-provided data as replacements', async () => {
    const getSql = stubQueryRun();

    await sequelize.getQueryInterface().rawSelect(User.tableName, {
      // @ts-expect-error -- we'll fix the typings when we migrate query-generator to TypeScript
      attributes: ['id'],
      where: {
        username: 'some :data'
      },
      replacements: {
        data: 'OR \' = '
      }
    }, 'id', User);

    expectsql(getSql(), {
      default: 'SELECT [id] FROM [Users] AS [User] WHERE [User].[username] = \'some :data\';',
      oracle: 'SELECT "id" FROM "Users" "User" WHERE "User"."username" = \'some :data\';',
      mssql: 'SELECT [id] FROM [Users] AS [User] WHERE [User].[username] = N\'some :data\';'
    });
  });
});
