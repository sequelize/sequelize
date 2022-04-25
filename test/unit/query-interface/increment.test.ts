import { DataTypes } from '@sequelize/core';
import { expect } from 'chai';
import sinon from 'sinon';
import { expectsql, sequelize } from '../../support';

describe('QueryInterface#increment', () => {
  const User = sequelize.define('User', {
    firstName: DataTypes.STRING,
  }, { timestamps: false });

  afterEach(() => {
    sinon.restore();
  });

  // you'll find more replacement tests in query-generator tests
  it('does not parse replacements outside of raw sql', async () => {
    const stub = sinon.stub(sequelize, 'queryRaw');

    await sequelize.getQueryInterface().increment(
      User,
      User.tableName,
      // where
      { id: ':id' },
      // incrementAmountsByField
      { age: ':age' },
      // extraAttributesToBeUpdated
      { name: ':name' },
      // options
      {
        returning: [':data'],
        replacements: {
          age: 1,
          id: 2,
          data: 3,
        },
      },
    );

    expect(stub.callCount).to.eq(1);
    const firstCall = stub.getCall(0);
    expectsql(firstCall.args[0] as string, {
      postgres: `UPDATE "Users" SET "age"="age"+ ':age',"name"=':name' WHERE "id" = ':id' RETURNING ":data"`,
      default: `UPDATE [Users] SET [age]=[age]+ ':age',[name]=':name' WHERE [id] = ':id'`,
      mssql: `UPDATE [Users] SET [age]=[age]+ N':age',[name]=N':name' OUTPUT INSERTED.[:data] WHERE [id] = N':id';`,
    });
    expect(firstCall.args[1]?.bind).to.be.undefined;
  });
});
