const { DataTypes } = require('sequelize');
const { expect } = require('chai');
const sinon = require('sinon');
const { expectsql, sequelize } = require('../../support');

describe('QueryInterface#insert', () => {
  const User = sequelize.define('User', {
    firstName: DataTypes.STRING
  }, { timestamps: false });

  afterEach(() => {
    sinon.restore();
  });

  // you'll find more replacement tests in query-generator tests
  it('does not parse replacements outside of raw sql', async () => {
    const stub = sinon.stub(sequelize, 'queryRaw');

    await sequelize.getQueryInterface().insert(null, User.tableName, {
      firstName: 'Zoe'
    }, {
      returning: [':data'],
      replacements: {
        data: 'abc'
      }
    });

    expect(stub.callCount).to.eq(1);
    const firstCall = stub.getCall(0);
    expectsql(firstCall.args[0], {
      postgres: 'INSERT INTO "Users" ("firstName") VALUES ($sequelize_1) RETURNING ":data";',
      default: 'INSERT INTO [Users] ([firstName]) VALUES ($sequelize_1);',
      mssql: 'INSERT INTO [Users] ([firstName]) OUTPUT INSERTED.[:data] VALUES ($sequelize_1);',
      db2: 'SELECT * FROM FINAL TABLE (INSERT INTO "Users" ("firstName") VALUES ($sequelize_1));'
    });
    expect(firstCall.args[1]?.bind).to.deep.eq({
      sequelize_1: 'Zoe'
    });
  });
});
