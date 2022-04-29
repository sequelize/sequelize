const { DataTypes } = require('sequelize');
const { expect } = require('chai');
const sinon = require('sinon');
const { expectsql, sequelize } = require('../../support');

describe('QueryInterface#bulkUpdate', () => {
  const User = sequelize.define('User', {
    firstName: DataTypes.STRING
  }, { timestamps: false });

  afterEach(() => {
    sinon.restore();
  });

  // you'll find more replacement tests in query-generator tests
  it('does not parse replacements outside of raw sql', async () => {
    const stub = sinon.stub(sequelize, 'queryRaw').resolves([[], 0]);

    await sequelize.getQueryInterface().bulkUpdate(
      User.tableName,
      {
        // values
        firstName: ':injection'
      },
      {
        // where
        firstName: ':injection'
      },
      {
        replacements: {
          injection: 'raw sql'
        }
      },
      {}
    );

    expect(stub.callCount).to.eq(1);
    const firstCall = stub.getCall(0);
    expectsql(firstCall.args[0], {
      default: 'UPDATE [Users] SET [firstName]=$sequelize_1 WHERE [firstName] = $sequelize_2',
      db2: 'SELECT * FROM FINAL TABLE (UPDATE "Users" SET "firstName"=$sequelize_1 WHERE "firstName" = $sequelize_2);'
    });

    expect(firstCall.args[1]?.bind).to.deep.eq({
      sequelize_1: ':injection',
      sequelize_2: ':injection'
    });
  });
});
