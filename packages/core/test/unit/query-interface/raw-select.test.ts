import { DataTypes } from '@sequelize/core';
import { expect } from 'chai';
import sinon from 'sinon';
import { beforeAll2, expectsql, sequelize } from '../../support';

describe('QueryInterface#rawSelect', () => {
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
  it('does not parse user-provided data as replacements', async () => {
    const { User } = vars;
    const stub = sinon.stub(sequelize, 'queryRaw');

    await sequelize.queryInterface.rawSelect(
      User.table,
      {
        // @ts-expect-error -- we'll fix the typings when we migrate query-generator to TypeScript
        attributes: ['id'],
        where: {
          username: 'some :data',
        },
        replacements: {
          data: "OR ' = ",
        },
      },
      'id',
      User,
    );

    expect(stub.callCount).to.eq(1);
    const firstCall = stub.getCall(0);
    expectsql(firstCall.args[0], {
      default: `SELECT [id] FROM [Users] AS [User] WHERE [User].[username] = 'some :data';`,
      mssql: `SELECT [id] FROM [Users] AS [User] WHERE [User].[username] = N'some :data';`,
    });
  });
});
