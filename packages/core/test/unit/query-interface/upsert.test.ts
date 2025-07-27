import { DataTypes, literal } from '@sequelize/core';
import { expect } from 'chai';
import sinon from 'sinon';
import { beforeAll2, expectsql, sequelize } from '../../support';

const dialectName = sequelize.dialect.name;

describe('QueryInterface#upsert', () => {
  if (!sequelize.dialect.supports.upserts) {
    return;
  }

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

    await sequelize.queryInterface.upsert(
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
    expectsql(firstCall.args[0], {
      default:
        'INSERT INTO [Users] ([firstName]) VALUES ($sequelize_1) ON CONFLICT ([id]) DO UPDATE SET [firstName]=EXCLUDED.[firstName];',
      'mariadb mysql':
        'INSERT INTO `Users` (`firstName`) VALUES ($sequelize_1) ON DUPLICATE KEY UPDATE `firstName`=$sequelize_1;',
      mssql: `
        MERGE INTO [Users] WITH(HOLDLOCK)
          AS [Users_target]
        USING (VALUES(N':name')) AS [Users_source]([firstName])
        ON [Users_target].[id] = [Users_source].[id]
        WHEN MATCHED THEN
          UPDATE SET [Users_target].[firstName] = N':name'
        WHEN NOT MATCHED THEN
          INSERT ([firstName]) VALUES(N':name') OUTPUT $action, INSERTED.*;
      `,
      db2: `
        MERGE INTO "Users"
          AS "Users_target"
        USING (VALUES(':name')) AS "Users_source"("firstName")
        ON "Users_target"."id" = "Users_source"."id"
        WHEN MATCHED THEN
          UPDATE SET "Users_target"."firstName" = ':name'
        WHEN NOT MATCHED THEN
          INSERT ("firstName") VALUES(':name');
      `,
    });

    if (dialectName === 'mssql' || dialectName === 'db2') {
      expect(firstCall.args[1]?.bind).to.be.undefined;
    } else {
      expect(firstCall.args[1]?.bind).to.deep.eq({
        sequelize_1: ':name',
      });
    }
  });

  it('throws if a bind parameter name starts with the reserved "sequelize_" prefix', async () => {
    const { User } = vars;
    sinon.stub(sequelize, 'queryRaw');

    await expect(
      sequelize.queryInterface.upsert(
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
      ),
    ).to.be.rejectedWith(
      'Bind parameters cannot start with "sequelize_", these bind parameters are reserved by Sequelize.',
    );
  });

  it('merges user-provided bind parameters with sequelize-generated bind parameters (object bind)', async () => {
    const { User } = vars;
    const stub = sinon.stub(sequelize, 'queryRaw');

    await sequelize.queryInterface.upsert(
      User.tableName,
      {
        firstName: literal('$firstName'),
        lastName: 'Doe',
      },
      {},
      // TODO: weird mssql/db2 specific behavior that should be unified
      dialectName === 'mssql' || dialectName === 'db2' ? { id: 1 } : {},
      {
        model: User,
        bind: {
          firstName: 'John',
        },
      },
    );

    expect(stub.callCount).to.eq(1);
    const firstCall = stub.getCall(0);
    expectsql(firstCall.args[0], {
      default:
        'INSERT INTO [Users] ([firstName],[lastName]) VALUES ($firstName,$sequelize_1) ON CONFLICT ([id]) DO NOTHING;',
      'mariadb mysql':
        'INSERT INTO `Users` (`firstName`,`lastName`) VALUES ($firstName,$sequelize_1) ON DUPLICATE KEY UPDATE `id`=`id`;',
      mssql: `
        MERGE INTO [Users] WITH(HOLDLOCK) AS [Users_target]
        USING (VALUES($firstName, N'Doe')) AS [Users_source]([firstName], [lastName])
        ON [Users_target].[id] = [Users_source].[id]
        WHEN NOT MATCHED THEN
          INSERT ([firstName], [lastName]) VALUES($firstName, N'Doe')
        OUTPUT $action, INSERTED.*;
      `,
      db2: `
        MERGE INTO "Users" AS "Users_target"
        USING (VALUES($firstName, 'Doe')) AS "Users_source"("firstName", "lastName")
        ON "Users_target"."id" = "Users_source"."id"
        WHEN NOT MATCHED THEN
          INSERT ("firstName", "lastName") VALUES($firstName, 'Doe');
      `,
    });

    if (dialectName === 'mssql' || dialectName === 'db2') {
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
    const { User } = vars;
    const stub = sinon.stub(sequelize, 'queryRaw');

    await sequelize.queryInterface.upsert(
      User.tableName,
      {
        firstName: literal('$1'),
        lastName: 'Doe',
      },
      {},
      // TODO: weird mssql/db2 specific behavior that should be unified
      dialectName === 'mssql' || dialectName === 'db2' ? { id: 1 } : {},
      {
        model: User,
        bind: ['John'],
      },
    );

    expect(stub.callCount).to.eq(1);
    const firstCall = stub.getCall(0);
    expectsql(firstCall.args[0], {
      default:
        'INSERT INTO [Users] ([firstName],[lastName]) VALUES ($1,$sequelize_1) ON CONFLICT ([id]) DO NOTHING;',
      'mariadb mysql':
        'INSERT INTO `Users` (`firstName`,`lastName`) VALUES ($1,$sequelize_1) ON DUPLICATE KEY UPDATE `id`=`id`;',
      mssql: `
        MERGE INTO [Users] WITH(HOLDLOCK) AS [Users_target]
        USING (VALUES($1, N'Doe')) AS [Users_source]([firstName], [lastName])
        ON [Users_target].[id] = [Users_source].[id]
        WHEN NOT MATCHED THEN
          INSERT ([firstName], [lastName]) VALUES($1, N'Doe')
        OUTPUT $action, INSERTED.*;
      `,
      db2: `
        MERGE INTO "Users" AS "Users_target"
        USING (VALUES($1, 'Doe')) AS "Users_source"("firstName", "lastName")
        ON "Users_target"."id" = "Users_source"."id"
        WHEN NOT MATCHED THEN
          INSERT ("firstName", "lastName") VALUES($1, 'Doe');
      `,
    });

    // mssql does not generate any bind parameter
    if (dialectName === 'mssql' || dialectName === 'db2') {
      expect(firstCall.args[1]?.bind).to.deep.eq(['John']);
    } else {
      expect(firstCall.args[1]?.bind).to.deep.eq({
        1: 'John',
        sequelize_1: 'Doe',
      });
    }
  });

  it('binds parameters if they are literals', async () => {
    const { User } = vars;
    const stub = sinon.stub(sequelize, 'queryRaw');

    await sequelize.queryInterface.upsert(
      User.tableName,
      {
        firstName: 'Jonh',
        counter: literal('`counter` + 1'),
      },
      {
        counter: literal('`counter` + 1'),
      },
      // TODO: weird mssql/db2 specific behavior that should be unified
      dialectName === 'mssql' || dialectName === 'db2' ? { id: 1 } : {},
      {
        model: User,
      },
    );

    expect(stub.callCount).to.eq(1);
    const firstCall = stub.getCall(0);
    expectsql(firstCall.args[0], {
      default:
        'INSERT INTO `Users` (`firstName`,`counter`) VALUES ($sequelize_1,`counter` + 1) ON DUPLICATE KEY UPDATE `counter`=`counter` + 1;',
      postgres:
        'INSERT INTO "Users" ("firstName","counter") VALUES ($sequelize_1,`counter` + 1) ON CONFLICT ("id") DO UPDATE SET "counter"=EXCLUDED."counter";',
      mssql: `
        MERGE INTO [Users] WITH(HOLDLOCK) AS [Users_target]
        USING (VALUES(N'Jonh', \`counter\` + 1)) AS [Users_source]([firstName], [counter])
        ON [Users_target].[id] = [Users_source].[id] WHEN MATCHED THEN UPDATE SET [Users_target].[counter] = \`counter\` + 1
        WHEN NOT MATCHED THEN INSERT ([firstName], [counter]) VALUES(N'Jonh', \`counter\` + 1) OUTPUT $action, INSERTED.*;
        `,
      sqlite3:
        'INSERT INTO `Users` (`firstName`,`counter`) VALUES ($sequelize_1,`counter` + 1) ON CONFLICT (`id`) DO UPDATE SET `counter`=EXCLUDED.`counter`;',
      db2: `
        MERGE INTO "Users" AS "Users_target"
        USING (VALUES('Jonh', \`counter\` + 1)) AS "Users_source"("firstName", "counter")
        ON "Users_target"."id" = "Users_source"."id" WHEN MATCHED THEN UPDATE SET "Users_target"."counter" = \`counter\` + 1
        WHEN NOT MATCHED THEN INSERT ("firstName", "counter") VALUES('Jonh', \`counter\` + 1);
        `,
    });
  });
});
