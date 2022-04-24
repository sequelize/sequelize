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
      mssql: `
        MERGE INTO [Users] WITH(HOLDLOCK)
          AS [Users_target]
        USING (VALUES(N':name')) AS [Users_source]([firstName])
        ON [Users_target].[id] = [Users_source].[id]
        WHEN MATCHED THEN
          UPDATE SET [Users_target].[firstName] = N':name'
        WHEN NOT MATCHED THEN
          INSERT ([firstName]) VALUES(N':name') OUTPUT $action, INSERTED.*;`,
    });

    if (dialectName === 'mssql') {
      expect(firstCall.args[1]?.bind).to.be.undefined;
    } else {
      expect(firstCall.args[1]?.bind).to.deep.eq({
        sequelize_1: ':name',
      });
    }
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
        firstName: 'John',
        lastName: 'Doe',
      },
      {},
      dialectName === 'mssql' ? { id: 1 } : {},
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
      mssql: `
        MERGE INTO [Users] WITH(HOLDLOCK) AS [Users_target]
        USING (VALUES(N'John', N'Doe')) AS [Users_source]([firstName], [lastName])
        ON [Users_target].[id] = [Users_source].[id]
        WHEN NOT MATCHED THEN
          INSERT ([firstName], [lastName]) VALUES(N'John', N'Doe')
        OUTPUT $action, INSERTED.*;
      `,
    });

    if (dialectName === 'mssql') {
      expect(firstCall.args[1]?.bind).to.deep.eq({
        firstName: 'John',
      });
    } else {
      expect(firstCall.args[1]?.bind).to.deep.eq({
        firstName: 'John',
        sequelize_1: 'Doe',
      });
    }
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
      dialectName === 'mssql' ? { id: 1 } : {},
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
      mssql: `
        MERGE INTO [Users] WITH(HOLDLOCK) AS [Users_target]
        USING (VALUES($1, N'Doe')) AS [Users_source]([firstName], [lastName])
        ON [Users_target].[id] = [Users_source].[id]
        WHEN NOT MATCHED THEN
          INSERT ([firstName], [lastName]) VALUES($1, N'Doe')
        OUTPUT $action, INSERTED.*;
      `,
    });

    // mssql does not generate any bind parameter
    if (dialectName === 'mssql') {
      expect(firstCall.args[1]?.bind).to.deep.eq(['John']);
    } else {
      expect(firstCall.args[1]?.bind).to.deep.eq({
        1: 'John',
        sequelize_1: 'Doe',
      });
    }
  });
});
