import { expect } from 'chai';
import sinon from 'sinon';
import { DataTypes } from '@sequelize/core';
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
      User.table,
      // where
      { firstName: ':firstName' },
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
      default: `UPDATE [Users] SET [age]=[age]+ ':age',[name]=':name' WHERE [firstName] = ':firstName'`,
      postgres: `UPDATE "Users" SET "age"="age"+ ':age',"name"=':name' WHERE "firstName" = ':firstName' RETURNING ":data"`,
      mssql: `UPDATE [Users] SET [age]=[age]+ N':age',[name]=N':name' OUTPUT INSERTED.[:data] WHERE [firstName] = N':firstName'`,
    });
    expect(firstCall.args[1]?.bind).to.be.undefined;
  });
});
