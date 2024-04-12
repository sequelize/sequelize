import { DataTypes, Op, literal } from '@sequelize/core';
import { expect } from 'chai';
import sinon from 'sinon';
import { beforeAll2, expectsql, sequelize } from '../../support';

describe('QueryInterface#update', () => {
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

    const instance = User.build();

    await sequelize.queryInterface.update(
      instance,
      User.table,
      { firstName: ':name' },
      { firstName: ':firstName' },
      {
        returning: [':data'],
        replacements: {
          name: 'Zoe',
          data: 'abc',
        },
      },
    );

    expect(stub.callCount).to.eq(1);
    const firstCall = stub.getCall(0);
    expectsql(firstCall.args[0], {
      default: 'UPDATE [Users] SET [firstName]=$sequelize_1 WHERE [firstName] = $sequelize_2',
      sqlite3:
        'UPDATE `Users` SET `firstName`=$sequelize_1 WHERE `firstName` = $sequelize_2 RETURNING `:data`',
      postgres:
        'UPDATE "Users" SET "firstName"=$sequelize_1 WHERE "firstName" = $sequelize_2 RETURNING ":data"',
      mssql:
        'UPDATE [Users] SET [firstName]=$sequelize_1 OUTPUT INSERTED.[:data] WHERE [firstName] = $sequelize_2',
      db2: `SELECT * FROM FINAL TABLE (UPDATE "Users" SET "firstName"=$sequelize_1 WHERE "firstName" = $sequelize_2);`,
    });
    expect(firstCall.args[1]?.bind).to.deep.eq({
      sequelize_1: ':name',
      sequelize_2: ':firstName',
    });
  });

  it('throws if a bind parameter name starts with the reserved "sequelize_" prefix', async () => {
    const { User } = vars;
    sinon.stub(sequelize, 'queryRaw');

    const instance = User.build();

    await expect(
      sequelize.queryInterface.update(
        instance,
        User.table,
        { firstName: 'newName' },
        { id: literal('$sequelize_test') },
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

    const instance = User.build();

    await sequelize.queryInterface.update(
      instance,
      User.table,
      { firstName: 'newName' },
      { id: { [Op.eq]: literal('$id') } },
      {
        bind: {
          id: 'test',
        },
      },
    );

    expect(stub.callCount).to.eq(1);
    const firstCall = stub.getCall(0);
    expectsql(firstCall.args[0], {
      default: 'UPDATE [Users] SET [firstName]=$sequelize_1 WHERE [id] = $id',
      db2: `SELECT * FROM FINAL TABLE (UPDATE "Users" SET "firstName"=$sequelize_1 WHERE "id" = $id);`,
    });

    expect(firstCall.args[1]?.bind).to.deep.eq({
      sequelize_1: 'newName',
      id: 'test',
    });
  });

  it('merges user-provided bind parameters with sequelize-generated bind parameters (array bind)', async () => {
    const { User } = vars;
    const stub = sinon.stub(sequelize, 'queryRaw');

    const instance = User.build();

    await sequelize.queryInterface.update(
      instance,
      User.table,
      { firstName: 'newName' },
      { id: { [Op.eq]: literal('$1') } },
      {
        bind: ['test'],
      },
    );

    expect(stub.callCount).to.eq(1);
    const firstCall = stub.getCall(0);
    expectsql(firstCall.args[0], {
      default: 'UPDATE [Users] SET [firstName]=$sequelize_1 WHERE [id] = $1',
      db2: `SELECT * FROM FINAL TABLE (UPDATE "Users" SET "firstName"=$sequelize_1 WHERE "id" = $1);`,
    });

    expect(firstCall.args[1]?.bind).to.deep.eq({
      sequelize_1: 'newName',
      1: 'test',
    });
  });
});
