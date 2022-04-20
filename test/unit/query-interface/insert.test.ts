import { DataTypes } from '@sequelize/core';
import { expect } from 'chai';
import sinon from 'sinon';
import { sequelize } from '../../support';

describe('QueryInterface#insert', () => {
  const User = sequelize.define('User', {
    firstName: DataTypes.STRING,
  }, { timestamps: false });

  afterEach(() => {
    sinon.restore();
  });

  // you'll find more replacement tests in query-generator tests
  it('does not parse replacements outside of raw sql', async () => {
    const stub = sinon.stub(sequelize, 'queryRaw');

    await sequelize.getQueryInterface().insert(null, User.tableName, {
      firstName: 'Zoe',
    }, {
      returning: [':data'],
      replacements: {
        data: 'abc',
      },
    });

    expect(stub.callCount).to.eq(1);
    const firstCall = stub.getCall(0);
    expect(firstCall.args[0]).to.eq('INSERT INTO "Users" ("firstName") VALUES ($1) RETURNING ":data";');
    expect(firstCall.args[1].bind).to.deep.eq(['Zoe']);
  });
});
