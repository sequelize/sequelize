import { expect } from 'chai';
import range from 'lodash/range';
import sinon from 'sinon';
import { DataTypes, Transaction } from '@sequelize/core';
import { expectPerDialect, expectsql, sequelize, toMatchRegex } from '../../support';

describe('QueryInterface#bulkInsert', () => {
  const User = sequelize.define('User', {
    firstName: DataTypes.STRING,
  }, { timestamps: false });

  afterEach(() => {
    sinon.restore();
  });

  it('uses minimal insert queries when rows <=1000', async () => {
    const stub = sinon.stub(sequelize, 'queryRaw').resolves([[], 0]);

    const users = range(1000).map(i => ({ firstName: `user${i}` }));
    await sequelize.queryInterface.bulkInsert(User, users);

    expect(stub.callCount).to.eq(1);
    const firstCall = stub.getCall(0).args[0];

    expectPerDialect(() => firstCall, {
      default: toMatchRegex(/^INSERT INTO (?:`|")Users(?:`|") \((?:`|")firstName(?:`|")\) VALUES (?:\('\w+'\),){999}\('\w+'\)$/),
      mssql: toMatchRegex(/^INSERT INTO \[Users\] \(\[firstName\]\) VALUES (?:\(N'\w+'\),){999}\(N'\w+'\)$/),
    });
  });

  it('uses minimal insert queries when rows >1000', async () => {
    const stub = sinon.stub(sequelize, 'queryRaw').resolves([[], 0]);
    const transaction = new Transaction(sequelize, {});

    const users = range(2000).map(i => ({ firstName: `user${i}` }));
    await sequelize.queryInterface.bulkInsert(User, users, { transaction });

    expect(stub.callCount).to.eq(1);
    const firstCall = stub.getCall(0).args[0];

    expectPerDialect(() => firstCall, {
      default: toMatchRegex(/^INSERT INTO (?:`|")Users(?:`|") \((?:`|")firstName(?:`|")\) VALUES (?:\('\w+'\),){1999}\('\w+'\)$/),
      mssql: toMatchRegex(/^INSERT INTO \[Users\] \(\[firstName\]\) VALUES (?:\(N'\w+'\),){999}\(N'\w+'\);INSERT INTO \[Users\] \(\[firstName\]\) VALUES (?:\(N'\w+'\),){999}\(N'\w+'\)$/),
    });
  });

  // you'll find more replacement tests in query-generator tests
  it('does not parse replacements outside of raw sql', async () => {
    const stub = sinon.stub(sequelize, 'queryRaw').resolves([[], 0]);

    await sequelize.queryInterface.bulkInsert(User, [{
      firstName: ':injection',
    }], {
      replacements: {
        injection: 'raw sql',
      },
    });

    expect(stub.callCount).to.eq(1);
    const firstCall = stub.getCall(0).args[0];

    expectsql(() => firstCall, {
      default: `INSERT INTO [Users] ([firstName]) VALUES (':injection')`,
      mssql: `INSERT INTO [Users] ([firstName]) VALUES (N':injection')`,
    });
  });
});
