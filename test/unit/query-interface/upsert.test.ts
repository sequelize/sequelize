import { DataTypes } from '@sequelize/core';
import { expect } from 'chai';
import sinon from 'sinon';
import { sequelize } from '../../support';

describe('QueryInterface#upsert', () => {
  const User = sequelize.define('User', {
    firstName: DataTypes.STRING,
  }, { timestamps: false });

  afterEach(() => {
    sinon.restore();
  });

  // you'll find more replacement tests in query-generator tests
  it('does not parse replacements outside of raw sql', async () => {
    const stub = sinon.stub(sequelize, 'queryRaw');

    await sequelize.getQueryInterface().upsert(
      User.tableName,
      { firstName: ':name' },
      { firstName: ':name' },
      { id: ':id' },
      {
        model: User,
        replacements: {
          name: 'Zoe',
          data: 'abc',
        },
      },
    );

    expect(stub.callCount).to.eq(1);
    const firstCall = stub.getCall(0);
    expect(firstCall.args[0]).to.eq('INSERT INTO "Users" ("firstName") VALUES ($1) ON CONFLICT ("id") DO UPDATE SET "firstName"=EXCLUDED."firstName";');
    expect(firstCall.args[1]?.bind).to.deep.eq([':name']);
  });
});
