const { DataTypes } = require('sequelize');
const sinon = require('sinon');
const { expectsql, sequelize } = require('../../support');
const { stubQueryRun } = require('./stub-query-run');

describe('QueryInterface#delete', () => {
  const User = sequelize.define('User', {
    firstName: DataTypes.STRING
  }, { timestamps: false });

  afterEach(() => {
    sinon.restore();
  });

  // you'll find more replacement tests in query-generator tests
  it('does not parse replacements outside of raw sql', async () => {
    const getSql = stubQueryRun();
    const instance = new User();

    await sequelize.getQueryInterface().delete(
      instance,
      User.tableName,
      { id: ':id' },
      {
        replacements: {
          limit: 1,
          id: '123'
        }
      }
    );

    expectsql(getSql(), {
      default: 'DELETE FROM [Users] WHERE [id] = \':id\'',
      mssql: 'DELETE FROM [Users] WHERE [id] = N\':id\'; SELECT @@ROWCOUNT AS AFFECTEDROWS;',
      snowflake: 'DELETE FROM "Users" WHERE "id" = \':id\';'
    });
  });
});
