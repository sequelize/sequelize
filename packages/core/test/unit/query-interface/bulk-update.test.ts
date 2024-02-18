import { DataTypes, Op, literal } from '@sequelize/core';
import { expect } from 'chai';
import sinon from 'sinon';
import { beforeAll2, expectsql, sequelize } from '../../support';

describe('QueryInterface#bulkUpdate', () => {
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
    const stub = sinon.stub(sequelize, 'queryRaw').resolves([[], 0]);

    await sequelize.queryInterface.bulkUpdate(
      User.table,
      {
        // values
        firstName: ':injection',
      },
      {
        // where
        firstName: ':injection',
      },
      {
        replacements: {
          injection: 'raw sql',
        },
      },
      {},
    );

    expect(stub.callCount).to.eq(1);
    const firstCall = stub.getCall(0);
    expectsql(firstCall.args[0], {
      default: `UPDATE [Users] SET [firstName]=$sequelize_1 WHERE [firstName] = $sequelize_2`,
      db2: `SELECT * FROM FINAL TABLE (UPDATE "Users" SET "firstName"=$sequelize_1 WHERE "firstName" = $sequelize_2);`,
    });

    expect(firstCall.args[1]?.bind).to.deep.eq({
      sequelize_1: ':injection',
      sequelize_2: ':injection',
    });
  });

  it('throws if a bind parameter name starts with the reserved "sequelize_" prefix', async () => {
    const { User } = vars;
    sinon.stub(sequelize, 'queryRaw');

    await expect(
      sequelize.queryInterface.bulkUpdate(
        User.table,
        {
          firstName: literal('$sequelize_test'),
        },
        {},
        {
          bind: {
            sequelize_test: 'raw sql',
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

    await sequelize.queryInterface.bulkUpdate(
      User.table,
      {
        firstName: 'newName',
      },
      {
        // where
        firstName: { [Op.eq]: literal('$one') },
      },
      {
        bind: { one: 'bind1' },
      },
    );

    expect(stub.callCount).to.eq(1);
    const firstCall = stub.getCall(0);
    expectsql(firstCall.args[0], {
      default: 'UPDATE [Users] SET [firstName]=$sequelize_1 WHERE [firstName] = $one',
      db2: `SELECT * FROM FINAL TABLE (UPDATE "Users" SET "firstName"=$sequelize_1 WHERE "firstName" = $one);`,
    });

    expect(firstCall.args[1]?.bind).to.deep.eq({
      sequelize_1: 'newName',
      one: 'bind1',
    });
  });

  it('merges user-provided bind parameters with sequelize-generated bind parameters (array bind)', async () => {
    const { User } = vars;
    const stub = sinon.stub(sequelize, 'queryRaw');

    await sequelize.queryInterface.bulkUpdate(
      User.table,
      {
        firstName: 'newName',
      },
      {
        // where
        firstName: { [Op.eq]: literal('$1') },
      },
      {
        bind: ['bind1'],
      },
    );

    expect(stub.callCount).to.eq(1);
    const firstCall = stub.getCall(0);
    expectsql(firstCall.args[0], {
      default: 'UPDATE [Users] SET [firstName]=$sequelize_1 WHERE [firstName] = $1',
      db2: `SELECT * FROM FINAL TABLE (UPDATE "Users" SET "firstName"=$sequelize_1 WHERE "firstName" = $1);`,
    });

    expect(firstCall.args[1]?.bind).to.deep.eq({
      sequelize_1: 'newName',
      1: 'bind1',
    });
  });
});
