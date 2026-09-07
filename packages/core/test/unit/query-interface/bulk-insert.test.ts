import { DataTypes, ParameterStyle, Transaction } from '@sequelize/core';
import { expect } from 'chai';
import range from 'lodash/range';
import sinon from 'sinon';
import { beforeAll2, expectPerDialect, sequelize, toMatchRegex, toMatchSql } from '../../support';

const { bulkInsertParameterStyles } = sequelize.dialect.supports.inserts;
const bindIfSupported = bulkInsertParameterStyles[ParameterStyle.BIND]
  ? { parameterStyle: ParameterStyle.BIND }
  : {};

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
    await sequelize.queryInterface.bulkInsert(User.table, users, bindIfSupported);

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
      // oracle uses `executeMany()` provided by node-oracledb driver and passes the value with binds
      oracle: toMatchRegex(/^INSERT INTO "Users" \("firstName"\) VALUES \(:\d+\)$/),
    });

    if (sequelize.dialect.name === 'oracle') {
      expect(stub.getCall(0).args[1]?.bind).to.deep.eq(users.map(user => [user.firstName]));
    }
  });

  it('uses minimal insert queries when rows >1000', async () => {
    const { User } = vars;
    const stub = sinon.stub(sequelize, 'queryRaw').resolves([[], 0]);
    const transaction = new Transaction(sequelize, {});

    const users = range(2000).map(i => ({ firstName: `user${i}` }));
    await sequelize.queryInterface.bulkInsert(User.table, users, {
      transaction,
      ...bindIfSupported,
    });

    expect(stub.callCount).to.eq(1);
    const firstCall = stub.getCall(0);
    const firstOpts = firstCall.args[1];
    if (firstOpts && typeof firstOpts === 'object') {
      expect(firstOpts.transaction).to.equal(transaction);
      if (['db2', 'mssql'].includes(sequelize.dialect.name)) {
        expect(firstOpts).to.not.have.property('bind');
      } else if (sequelize.dialect.name === 'oracle') {
        expect(firstOpts.bind).to.deep.eq(users.map(user => [user.firstName]));
      } else {
        expect(firstOpts).to.have.property('bind');
        expect(Object.keys(firstOpts.bind || {})).to.have.lengthOf(2000);
        expect(firstOpts.bind).to.include({ sequelize_1: 'user0' });
        expect(firstOpts.bind).to.have.property('sequelize_2000', 'user1999');
      }
    } else {
      throw new Error('expected the options to be passed as an object');
    }

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
      oracle: toMatchRegex(/^INSERT INTO "Users" \("firstName"\) VALUES \(:\d+\)$/),
    });

    if (sequelize.dialect.name === 'oracle') {
      expect(stub.getCall(0).args[1]?.bind).to.deep.eq(users.map(user => [user.firstName]));
    }
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
    const firstCall = stub.getCall(0);

    expectPerDialect(() => firstCall.args[0], {
      default: toMatchSql('INSERT INTO "Users" ("firstName") VALUES (\':injection\');'),
      'mysql mariadb sqlite3': toMatchSql(
        "INSERT INTO `Users` (`firstName`) VALUES (':injection');",
      ),
      mssql: toMatchSql(`INSERT INTO [Users] ([firstName]) VALUES (N':injection');`),
      // TODO: db2 should use the same system as ibmi
      ibmi: toMatchSql(
        `SELECT * FROM FINAL TABLE (INSERT INTO "Users" ("firstName") VALUES (':injection'))`,
      ),
      oracle: toMatchSql(`INSERT INTO "Users" ("firstName") VALUES (:1)`),
    });

    if (sequelize.dialect.name === 'oracle') {
      expect(stub.getCall(0).args[1]?.bind).to.deep.eq([[':injection']]);
    } else {
      expect(stub.getCall(0).args[1]).to.not.have.property('bind');
    }
  });

  const unsupportedStyle = [ParameterStyle.REPLACEMENT, ParameterStyle.BIND].find(
    style => !bulkInsertParameterStyles[style],
  );

  if (unsupportedStyle) {
    it(`rejects parameterStyle ${unsupportedStyle}, which the dialect does not support`, async () => {
      const { User } = vars;
      const stub = sinon.stub(sequelize, 'queryRaw').resolves([[], 0]);

      await expect(
        sequelize.queryInterface.bulkInsert(User.table, [{ firstName: 'a' }], {
          parameterStyle: unsupportedStyle,
        }),
      ).to.be.rejectedWith(
        Error,
        `parameterStyle "${unsupportedStyle}" is not supported by bulk inserts in the ${sequelize.dialect.name} dialect`,
      );

      expect(stub.callCount).to.eq(0);
    });
  }

  it('rejects unknown parameterStyle values', async () => {
    const { User } = vars;

    await expect(
      sequelize.queryInterface.bulkInsert(User.table, [{ firstName: 'a' }], {
        // @ts-expect-error -- testing invalid input
        parameterStyle: 'nope',
      }),
    ).to.be.rejectedWith(Error, 'parameterStyle "nope" is not supported by bulk inserts');
  });

  it('does not forward an empty bind when the dialect inlines all values', async () => {
    const { User } = vars;
    const stub = sinon.stub(sequelize, 'queryRaw').resolves([[], 0]);

    await sequelize.queryInterface.bulkInsert(User.table, [{ firstName: 'a' }]);

    expect(stub.callCount).to.eq(1);
    const options = stub.getCall(0).args[1];

    if (sequelize.dialect.name === 'oracle') {
      expect(options?.bind).to.deep.eq([['a']]);
    } else {
      expect(options).to.not.have.property('bind');
    }
  });

  if (!bulkInsertParameterStyles[ParameterStyle.REPLACEMENT]) {
    it('rejects user-provided binds, because bulk inserts use positional binds per row', async () => {
      const { User } = vars;
      const stub = sinon.stub(sequelize, 'queryRaw').resolves([[], 0]);

      await expect(
        sequelize.queryInterface.bulkInsert(User.table, [{ firstName: 'a' }], {
          bind: { custom: 1 },
        }),
      ).to.be.rejectedWith(Error, 'does not support the "bind" option in bulkInsert');

      expect(stub.callCount).to.eq(0);
    });
  } else {
    it('forwards user-provided binds untouched in replacement mode', async () => {
      const { User } = vars;
      const stub = sinon.stub(sequelize, 'queryRaw').resolves([[], 0]);

      await sequelize.queryInterface.bulkInsert(User.table, [{ firstName: 'a' }], {
        bind: { custom: 1 },
      });

      expect(stub.callCount).to.eq(1);
      expect(stub.getCall(0).args[1]?.bind).to.deep.eq({ custom: 1 });
    });
  }
});
