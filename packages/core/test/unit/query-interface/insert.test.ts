import { DataTypes, literal } from '@sequelize/core';
import { expect } from 'chai';
import sinon from 'sinon';
import { beforeAll2, expectsql, sequelize } from '../../support';

describe('QueryInterface#insert', () => {
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
  it('does not parse replacements outside of raw sql', async () => {
    const { User } = vars;
    const stub = sinon.stub(sequelize, 'queryRaw');

    await sequelize.queryInterface.insert(
      null,
      User.table,
      {
        firstName: 'Zoe',
      },
      {
        returning: [':data'],
        replacements: {
          data: 'abc',
        },
      },
    );

    expect(stub.callCount).to.eq(1);
    const firstCall = stub.getCall(0);
    expectsql(firstCall.args[0], {
      default: 'INSERT INTO [Users] ([firstName]) VALUES ($sequelize_1);',
      sqlite3: 'INSERT INTO `Users` (`firstName`) VALUES ($sequelize_1) RETURNING `:data`;',
      postgres: `INSERT INTO "Users" ("firstName") VALUES ($sequelize_1) RETURNING ":data";`,
      mssql: `INSERT INTO [Users] ([firstName]) OUTPUT INSERTED.[:data] VALUES ($sequelize_1);`,
      db2: `SELECT * FROM FINAL TABLE (INSERT INTO "Users" ("firstName") VALUES ($sequelize_1));`,
      ibmi: `SELECT * FROM FINAL TABLE (INSERT INTO "Users" ("firstName") VALUES ($sequelize_1))`,
    });
    expect(firstCall.args[1]?.bind).to.deep.eq({
      sequelize_1: 'Zoe',
    });
  });

  it('throws if a bind parameter name starts with the reserved "sequelize_" prefix', async () => {
    const { User } = vars;
    sinon.stub(sequelize, 'queryRaw');

    await expect(
      sequelize.queryInterface.insert(
        null,
        User.table,
        {
          firstName: literal('$sequelize_test'),
        },
        {
          bind: {
            sequelize_test: 'test',
          },
        },
      ),
    ).to.be.rejectedWith(
      'Bind parameters cannot start with "sequelize_", these bind parameters are reserved by Sequelize.',
    );
  });

  it('merges user-provided bind parameters with sequelize-generated bind parameters (object bind)', async () => {
    const { User } = vars;
    const stub = sinon.stub(sequelize, 'queryRaw');

    await sequelize.queryInterface.insert(
      null,
      User.table,
      {
        firstName: literal('$firstName'),
        lastName: 'Doe',
      },
      {
        bind: {
          firstName: 'John',
        },
      },
    );

    expect(stub.callCount).to.eq(1);
    const firstCall = stub.getCall(0);
    expectsql(firstCall.args[0], {
      default: 'INSERT INTO [Users] ([firstName],[lastName]) VALUES ($firstName,$sequelize_1);',
      db2: `SELECT * FROM FINAL TABLE (INSERT INTO "Users" ("firstName","lastName") VALUES ($firstName,$sequelize_1));`,
      ibmi: `SELECT * FROM FINAL TABLE (INSERT INTO "Users" ("firstName","lastName") VALUES ($firstName,$sequelize_1))`,
    });

    expect(firstCall.args[1]?.bind).to.deep.eq({
      firstName: 'John',
      sequelize_1: 'Doe',
    });
  });

  it('merges user-provided bind parameters with sequelize-generated bind parameters (array bind)', async () => {
    const { User } = vars;
    const stub = sinon.stub(sequelize, 'queryRaw');

    await sequelize.queryInterface.insert(
      null,
      User.table,
      {
        firstName: literal('$1'),
        lastName: 'Doe',
      },
      {
        bind: ['John'],
      },
    );

    expect(stub.callCount).to.eq(1);
    const firstCall = stub.getCall(0);
    expectsql(firstCall.args[0], {
      default: 'INSERT INTO [Users] ([firstName],[lastName]) VALUES ($1,$sequelize_1);',
      db2: `SELECT * FROM FINAL TABLE (INSERT INTO "Users" ("firstName","lastName") VALUES ($1,$sequelize_1));`,
      ibmi: `SELECT * FROM FINAL TABLE (INSERT INTO "Users" ("firstName","lastName") VALUES ($1,$sequelize_1))`,
    });

    expect(firstCall.args[1]?.bind).to.deep.eq({
      1: 'John',
      sequelize_1: 'Doe',
    });
  });
});
