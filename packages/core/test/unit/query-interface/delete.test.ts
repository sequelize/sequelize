import { DataTypes } from '@sequelize/core';
import { expect } from 'chai';
import sinon from 'sinon';
import { beforeAll2, expectsql, sequelize } from '../../support';

describe('QueryInterface#delete', () => {
  const vars = beforeAll2(() => {
    const User = sequelize.define(
      'User',
      {
        firstName: DataTypes.STRING,
      },
      { timestamps: false },
    );

    return { User };
  });

  afterEach(() => {
    sinon.restore();
  });

  // you'll find more replacement tests in query-generator tests
  it('does not parse replacements outside of raw sql', async () => {
    const { User } = vars;
    const stub = sinon.stub(sequelize, 'queryRaw');

    await sequelize.queryInterface.bulkDelete(User, {
      where: { firstName: ':id' },
      replacements: {
        limit: 1,
        id: '123',
      },
    });

    expect(stub.callCount).to.eq(1);
    const firstCall = stub.getCall(0);
    expectsql(firstCall.args[0], {
      default: `DELETE FROM [Users] WHERE [firstName] = ':id'`,
      mssql: `DELETE FROM [Users] WHERE [firstName] = N':id'; SELECT @@ROWCOUNT AS AFFECTEDROWS;`,
    });

    expect(firstCall.args[1]?.bind).to.be.undefined;
  });
});
