import { DataTypes } from '@sequelize/core';
import { expect } from 'chai';
import sinon from 'sinon';
import { expectsql, sequelize } from '../../support';

describe('QueryInterface#select', () => {
  const User = sequelize.define('User', {
    firstName: DataTypes.STRING,
  }, { timestamps: false });

  afterEach(() => {
    sinon.restore();
  });

  // you'll find more replacement tests in query-generator tests
  it('does not parse user-provided data as replacements', async () => {
    const stub = sinon.stub(sequelize, 'queryRaw');

    await sequelize.getQueryInterface().select(User, User.tableName, {
      // @ts-expect-error -- we'll fix the typings when we migrate query-generator to TypeScript
      attributes: ['id'],
      where: {
        username: 'some :data',
      },
      replacements: {
        data: 'OR \' = ',
      },
    });

    expect(stub.callCount).to.eq(1);
    const firstCall = stub.getCall(0);
    expectsql(firstCall.args[0] as string, {
      default: `SELECT [id] FROM [Users] AS [User] WHERE [User].[username] = 'some :data';`,
    });
    expect(firstCall.args[1]?.bind).to.be.undefined;
  });

  // you'll find more bind tests in query-generator tests
  it('does not parse user-provided data as bind', async () => {
    const stub = sinon.stub(sequelize, 'queryRaw');

    await sequelize.getQueryInterface().select(User, User.tableName, {
      // @ts-expect-error -- we'll fix the typings when we migrate query-generator to TypeScript
      attributes: ['id'],
      where: {
        username: 'some $data',
      },
      bind: {
        data: 'fail',
      },
    });

    expect(stub.callCount).to.eq(1);
    const firstCall = stub.getCall(0);
    expectsql(firstCall.args[0] as string, {
      default: `SELECT [id] FROM [Users] AS [User] WHERE [User].[username] = 'some $data';`,
    });
    expect(firstCall.args[1]?.bind).to.be.undefined;
  });
});
