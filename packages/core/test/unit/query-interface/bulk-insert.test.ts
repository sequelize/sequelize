import { DataTypes, Transaction } from '@sequelize/core';
import { expect } from 'chai';
import range from 'lodash/range';
import sinon from 'sinon';
import { beforeAll2, expectPerDialect, sequelize, toMatchRegex, toMatchSql } from '../../support';

describe('QueryInterface#bulkInsert', () => {
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

  it('uses minimal insert queries when rows <=1000', async () => {
    const { User } = vars;
    const stub = sinon.stub(sequelize, 'queryRaw').resolves([[], 0]);

    const users = range(1000).map(i => ({ firstName: `user${i}` }));
    await sequelize.queryInterface.bulkInsert(User.table, users);

    expect(stub.callCount).to.eq(1);
    const firstCall = stub.getCall(0).args[0];

    expectPerDialect(() => firstCall, {
      default: toMatchRegex(
        /^INSERT INTO (?:`|")Users(?:`|") \((?:`|")firstName(?:`|")\) VALUES (?:\('\w+'\),){999}\('\w+'\);$/,
      ),
      ibmi: toMatchRegex(
        /^SELECT \* FROM FINAL TABLE \(INSERT INTO "Users" \("firstName"\) VALUES (?:\('\w+'\),){999}\('\w+'\)\)$/,
      ),
      mssql: toMatchRegex(
        /^INSERT INTO \[Users\] \(\[firstName\]\) VALUES (?:\(N'\w+'\),){999}\(N'\w+'\);$/,
      ),
    });
  });

  it('uses minimal insert queries when rows >1000', async () => {
    const { User } = vars;
    const stub = sinon.stub(sequelize, 'queryRaw').resolves([[], 0]);
    const transaction = new Transaction(sequelize, {});

    const users = range(2000).map(i => ({ firstName: `user${i}` }));
    await sequelize.queryInterface.bulkInsert(User.table, users, { transaction });

    expect(stub.callCount).to.eq(1);
    const firstCall = stub.getCall(0).args[0];

    expectPerDialect(() => firstCall, {
      default: toMatchRegex(
        /^INSERT INTO (?:`|")Users(?:`|") \((?:`|")firstName(?:`|")\) VALUES (?:\('\w+'\),){1999}\('\w+'\);$/,
      ),
      ibmi: toMatchRegex(
        /^SELECT \* FROM FINAL TABLE \(INSERT INTO "Users" \("firstName"\) VALUES (?:\('\w+'\),){1999}\('\w+'\)\)$/,
      ),
      mssql: toMatchRegex(
        /^(?:INSERT INTO \[Users\] \(\[firstName\]\) VALUES (?:\(N'\w+'\),){999}\(N'\w+'\);){2}$/,
      ),
    });
  });

  // you'll find more replacement tests in query-generator tests
  it('does not parse replacements outside of raw sql', async () => {
    const { User } = vars;
    const stub = sinon.stub(sequelize, 'queryRaw').resolves([[], 0]);

    await sequelize.queryInterface.bulkInsert(
      User.table,
      [
        {
          firstName: ':injection',
        },
      ],
      {
        replacements: {
          injection: 'raw sql',
        },
      },
    );

    expect(stub.callCount).to.eq(1);
    const firstCall = stub.getCall(0).args[0];

    expectPerDialect(() => firstCall, {
      default: toMatchSql('INSERT INTO "Users" ("firstName") VALUES (\':injection\');'),
      'mysql mariadb sqlite3': toMatchSql(
        "INSERT INTO `Users` (`firstName`) VALUES (':injection');",
      ),
      mssql: toMatchSql(`INSERT INTO [Users] ([firstName]) VALUES (N':injection');`),
      // TODO: db2 should use the same system as ibmi
      ibmi: toMatchSql(
        `SELECT * FROM FINAL TABLE (INSERT INTO "Users" ("firstName") VALUES (':injection'))`,
      ),
    });
  });
});
