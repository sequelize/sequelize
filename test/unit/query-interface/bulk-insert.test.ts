import { DataTypes } from '@sequelize/core';
import { expect } from 'chai';
import sinon from 'sinon';
import { sequelize } from '../../support';

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
    expect(firstCall.args[0]).to.eq('INSERT INTO "Users" ("firstName") VALUES (\':injection\');');
    expect(firstCall.args[1]?.bind).to.be.undefined;
  });

  it('does not parse bind parameters outside of raw sql', async () => {
    const stub = sinon.stub(sequelize, 'queryRaw').resolves([[], 0]);

    await sequelize.getQueryInterface().bulkInsert(User.tableName, [{
      firstName: '$injection',
    }], {
      bind: {
        injection: 'raw sql',
      },
    });

    expect(stub.callCount).to.eq(1);
    const firstCall = stub.getCall(0);
    expect(firstCall.args[0]).to.eq('INSERT INTO "Users" ("firstName") VALUES (\'$injection\');');
    expect(firstCall.args[1]?.bind).to.be.undefined;
  });
});
