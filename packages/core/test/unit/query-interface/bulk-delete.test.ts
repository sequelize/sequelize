import { DataTypes, Op, sql } from '@sequelize/core';
import { expect } from 'chai';
import sinon from 'sinon';
import { beforeAll2, expectsql, sequelize } from '../../support';

describe('QueryInterface#bulkDelete', () => {
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

  it('refuses a where that was derived to be true for every row', async () => {
    const { User } = vars;
    const stub = sinon.stub(sequelize, 'queryRaw');

    await expect(
      sequelize.queryInterface.bulkDelete(User, { where: { firstName: { [Op.notIn]: [] } } }),
    ).to.be.rejectedWith(/is true for every row/);

    expect(stub.callCount).to.eq(0);
  });

  it('accepts a where the caller wrote to be true for every row', async () => {
    const stub = sinon.stub(sequelize, 'queryRaw');

    await sequelize.queryInterface.bulkDelete(vars.User, { where: sql`1 = 1` });

    expect(stub.callCount).to.eq(1);
    expectsql(stub.getCall(0).args[0], {
      default: `DELETE FROM [Users] WHERE 1 = 1`,
      mssql: `DELETE FROM [Users] WHERE 1 = 1; SELECT @@ROWCOUNT AS AFFECTEDROWS;`,
    });
  });

  it('does not pass rejectAlwaysTrueWhere on to queryRaw', async () => {
    const stub = sinon.stub(sequelize, 'queryRaw');

    await sequelize.queryInterface.bulkDelete(vars.User, { where: { firstName: 'foo' } });

    expect(stub.getCall(0).args[1]).to.not.have.property('rejectAlwaysTrueWhere');
  });
});
