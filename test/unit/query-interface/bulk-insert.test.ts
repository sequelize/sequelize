import { DataTypes } from '@sequelize/core';
import { expect } from 'chai';
import sinon from 'sinon';
import { expectsql, sequelize } from '../../support';

describe('QueryInterface#bulkInsert', () => {
  const User = sequelize.define('User', {
    firstName: DataTypes.STRING,
  }, { timestamps: false });

  afterEach(() => {
    sinon.restore();
  });

  // you'll find more replacement tests in query-generator tests
  it('does not parse replacements outside of raw sql', async () => {
    const stub = sinon.stub(sequelize, 'queryRaw').resolves([[], 0]);

    await sequelize.getQueryInterface().bulkInsert(User.tableName, [{
      firstName: ':injection',
    }], {
      replacements: {
        injection: 'raw sql',
      },
    });

    expect(stub.callCount).to.eq(1);
    const firstCall = stub.getCall(0);

    expectsql(firstCall.args[0] as string, {
      default: `INSERT INTO [Users] ([firstName]) VALUES (':injection');`,
    });
  });
});
