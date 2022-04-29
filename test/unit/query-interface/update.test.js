const { DataTypes } = require('sequelize');
const { expect } = require('chai');
const sinon = require('sinon');
const { expectsql, sequelize } = require('../../support');

describe('QueryInterface#update', () => {
  const User = sequelize.define('User', {
    firstName: DataTypes.STRING
  }, { timestamps: false });

  afterEach(() => {
    sinon.restore();
  });

  // you'll find more replacement tests in query-generator tests
  it('does not parse replacements outside of raw sql', async () => {
    const stub = sinon.stub(sequelize, 'queryRaw');

    const instance = new User();

    await sequelize.getQueryInterface().update(
      instance,
      User.tableName,
      { firstName: ':name' },
      { id: ':id' },
      {
        returning: [':data'],
        replacements: {
          name: 'Zoe',
          data: 'abc'
        }
      }
    );

    expect(stub.callCount).to.eq(1);
    const firstCall = stub.getCall(0);
    expectsql(firstCall.args[0], {
      default: 'UPDATE [Users] SET [firstName]=$sequelize_1 WHERE [id] = $sequelize_2',
      postgres: 'UPDATE "Users" SET "firstName"=$sequelize_1 WHERE "id" = $sequelize_2 RETURNING ":data"',
      mssql: 'UPDATE [Users] SET [firstName]=$sequelize_1 OUTPUT INSERTED.[:data] WHERE [id] = $sequelize_2',
      db2: 'SELECT * FROM FINAL TABLE (UPDATE "Users" SET "firstName"=$sequelize_1 WHERE "id" = $sequelize_2);'
    });
    expect(firstCall.args[1]?.bind).to.deep.eq({
      sequelize_1: ':name',
      sequelize_2: ':id'
    });
  });
});
