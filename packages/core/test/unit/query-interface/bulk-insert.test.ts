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
    await sequelize.queryInterface.bulkInsert(User.table, users, { parameterStyle: 'bind' });

    expect(stub.callCount).to.eq(1);
    const firstCall = stub.getCall(0).args[0];

    expectPerDialect(() => firstCall, {
      default: toMatchRegex(
        /^INSERT INTO (?:`|")Users(?:`|") \((?:`|")firstName(?:`|")\) VALUES (?:\(\$sequelize_\d+\),){999}\(\$sequelize_1000\);$/,
      ),
      db2: toMatchRegex(
        /^INSERT INTO (?:`|")Users(?:`|") \((?:`|")firstName(?:`|")\) VALUES (?:\('\w+'\),){999}\('\w+'\);$/,
      ),
      ibmi: toMatchRegex(
        /^SELECT \* FROM FINAL TABLE \(INSERT INTO "Users" \("firstName"\) VALUES (?:\(\$sequelize_\d+\),){999}\(\$sequelize_1000\)\)$/,
      ),
      mssql: toMatchRegex(
        /^INSERT INTO \[Users\] \(\[firstName\]\) VALUES (?:\(N'\w+'\),){999}\(N'\w+'\);$/,
      ),
    });

    const { bind } = stub.getCall(0).args[1];
    expect(bind).to.include({ sequelize_1: 'user0' });
    expect(bind).to.have.property('sequelize_1000', 'user999');
  });

  it('uses minimal insert queries when rows >1000', async () => {
    const { User } = vars;
    const stub = sinon.stub(sequelize, 'queryRaw').resolves([[], 0]);
    const transaction = new Transaction(sequelize, {});

    const users = range(2000).map(i => ({ firstName: `user${i}` }));
    await sequelize.queryInterface.bulkInsert(User.table, users, {
      transaction,
      parameterStyle: 'bind',
    });

    expect(stub.callCount).to.eq(1);
    const firstCall = stub.getCall(0);
    const firstOpts = firstCall.args[1];
    expect(firstOpts).to.have.property('bind');
    expect(Object.keys(firstOpts.bind)).to.have.lengthOf(2000);

    expectPerDialect(() => firstCall.args[0], {
      default: toMatchRegex(
        /^INSERT INTO (?:`|")Users(?:`|") \((?:`|")firstName(?:`|")\) VALUES (?:\(\$sequelize_\d+\),){1999}\(\$sequelize_2000\);$/,
      ),
      db2: toMatchRegex(
        /^INSERT INTO (?:`|")Users(?:`|") \((?:`|")firstName(?:`|")\) VALUES (?:\('\w+'\),){1999}\('\w+'\);$/,
      ),
      ibmi: toMatchRegex(
        /^SELECT \* FROM FINAL TABLE \(INSERT INTO "Users" \("firstName"\) VALUES (?:\(\$sequelize_\d+\),){1999}\(\$sequelize_2000\)\)$/,
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
        parameterStyle: 'replacement',
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
