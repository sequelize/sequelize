import { DataTypes, literal } from '@sequelize/core';
import { expect } from 'chai';
import sinon from 'sinon';
import { expectsql, sequelize } from '../../support';

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
    expectsql(firstCall.args[0] as string, {
      default: 'INSERT INTO [Users] ([firstName]) VALUES ($sequelize_1) ON CONFLICT ([id]) DO UPDATE SET [firstName]=EXCLUDED.[firstName];',
      mariadb: 'INSERT INTO `Users` (`firstName`) VALUES ($sequelize_1) ON DUPLICATE KEY UPDATE `firstName`=VALUES(`firstName`);',
      mysql: 'INSERT INTO `Users` (`firstName`) VALUES ($sequelize_1) ON DUPLICATE KEY UPDATE `firstName`=VALUES(`firstName`);',
    });
    expect(firstCall.args[1]?.bind).to.deep.eq({
      sequelize_1: ':name',
    });
  });

  it('throws if a bind parameter name starts with the reserved "sequelize_" prefix', async () => {
    sinon.stub(sequelize, 'queryRaw');

    await expect(sequelize.getQueryInterface().upsert(
      User.tableName,
      { firstName: literal('$sequelize_test') },
      { firstName: ':name' },
      { id: ':id' },
      {
        model: User,
        bind: {
          sequelize_test: 'test',
        },
      },
    )).to.be.rejectedWith('Bind parameters cannot start with "sequelize_", these bind parameters are reserved by Sequelize.');
  });

  it('merges user-provided bind parameters with sequelize-generated bind parameters (object bind)', async () => {
    const stub = sinon.stub(sequelize, 'queryRaw');

    await sequelize.getQueryInterface().upsert(
      User.tableName,
      {
        firstName: literal('$firstName'),
        lastName: 'Doe',
      },
      {},
      {},
      {
        model: User,
        bind: {
          firstName: 'John',
        },
      },
    );

    expect(stub.callCount).to.eq(1);
    const firstCall = stub.getCall(0);
    expectsql(firstCall.args[0] as string, {
      default: 'INSERT INTO [Users] ([firstName],[lastName]) VALUES ($firstName,$sequelize_1) ON CONFLICT ([id]) DO NOTHING;',
      mysql: 'INSERT INTO `Users` (`firstName`,`lastName`) VALUES ($firstName,$sequelize_1) ON DUPLICATE KEY UPDATE `id`=`id`;',
      mariadb: 'INSERT INTO `Users` (`firstName`,`lastName`) VALUES ($firstName,$sequelize_1) ON DUPLICATE KEY UPDATE `id`=`id`;',
    });

    expect(firstCall.args[1]?.bind).to.deep.eq({
      firstName: 'John',
      sequelize_1: 'Doe',
    });
  });

  it('merges user-provided bind parameters with sequelize-generated bind parameters (array bind)', async () => {
    const stub = sinon.stub(sequelize, 'queryRaw');

    await sequelize.getQueryInterface().upsert(
      User.tableName,
      {
        firstName: literal('$1'),
        lastName: 'Doe',
      },
      {},
      {},
      {
        model: User,
        bind: ['John'],
      },
    );

    expect(stub.callCount).to.eq(1);
    const firstCall = stub.getCall(0);
    expectsql(firstCall.args[0] as string, {
      default: 'INSERT INTO [Users] ([firstName],[lastName]) VALUES ($1,$sequelize_1) ON CONFLICT ([id]) DO NOTHING;',
      mysql: 'INSERT INTO `Users` (`firstName`,`lastName`) VALUES ($1,$sequelize_1) ON DUPLICATE KEY UPDATE `id`=`id`;',
      mariadb: 'INSERT INTO `Users` (`firstName`,`lastName`) VALUES ($1,$sequelize_1) ON DUPLICATE KEY UPDATE `id`=`id`;',
    });

    expect(firstCall.args[1]?.bind).to.deep.eq({
      1: 'John',
      sequelize_1: 'Doe',
    });
  });
});
