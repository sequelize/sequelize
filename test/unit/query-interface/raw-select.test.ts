import { DataTypes } from '@sequelize/core';
import { expect } from 'chai';
import sinon from 'sinon';
import { sequelize } from '../../support';

describe('QueryInterface#rawSelect', () => {
  const User = sequelize.define('User', {
    firstName: DataTypes.STRING,
  }, { timestamps: false });

  afterEach(() => {
    sinon.restore();
  });

  // you'll find more replacement tests in query-generator tests
  it('does not parse user-provided data as replacements', async () => {
    const stub = sinon.stub(sequelize, 'queryRaw');

    await sequelize.getQueryInterface().rawSelect(User.tableName, {
      // @ts-expect-error -- we'll fix the typings when we migrate query-generator to TypeScript
      attributes: ['id'],
      where: {
        username: 'some :data',
      },
      replacements: {
        data: 'OR \' = ',
      },
    }, 'id', User);

    expect(stub.callCount).to.eq(1);
    const firstCall = stub.getCall(0);
    expect(firstCall.args[0]).to.eq('SELECT "id" FROM "Users" AS "User" WHERE "User"."username" = \'some :data\';');
    expect(firstCall.args[1]?.bind).to.be.undefined;
  });

  // you'll find more bind tests in query-generator tests
  it('does not parse user-provided data as bind', async () => {
    const stub = sinon.stub(sequelize, 'queryRaw');

    await sequelize.getQueryInterface().rawSelect(User.tableName, {
      // @ts-expect-error -- we'll fix the typings when we migrate query-generator to TypeScript
      attributes: ['id'],
      where: {
        username: 'some $data',
      },
      bind: {
        data: 'fail',
      },
    }, 'id', User);

    expect(stub.callCount).to.eq(1);
    const firstCall = stub.getCall(0);
    expect(firstCall.args[0]).to.eq('SELECT "id" FROM "Users" AS "User" WHERE "User"."username" = \'some $data\';');
    expect(firstCall.args[1]?.bind).to.be.undefined;
  });
});
