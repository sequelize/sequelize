const { DataTypes } = require('sequelize');
const { expect } = require('chai');
const sinon = require('sinon');
const { expectsql, sequelize } = require('../../support');

const dialectName = sequelize.dialect.name;

describe('QueryInterface#upsert', () => {
  const User = sequelize.define('User', {
    firstName: DataTypes.STRING
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
          data: 'abc'
        }
      }
    );

    expect(stub.callCount).to.eq(1);
    const firstCall = stub.getCall(0);
    expectsql(firstCall.args[0], {
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
          INSERT ([firstName]) VALUES(N':name') OUTPUT $action, INSERTED.*;
      `,
      // TODO: does snowflake not support upsert?
      snowflake: 'INSERT INTO "Users" ("firstName") VALUES ($sequelize_1);',
      db2: `
        MERGE INTO "Users"
          AS "Users_target"
        USING (VALUES(':name')) AS "Users_source"("firstName")
        ON "Users_target"."id" = "Users_source"."id"
        WHEN MATCHED THEN
          UPDATE SET "Users_target"."firstName" = ':name'
        WHEN NOT MATCHED THEN
          INSERT ("firstName") VALUES(':name');
      `
    });

    if (dialectName === 'mssql' || dialectName === 'db2') {
      expect(firstCall.args[1]?.bind).to.be.undefined;
    } else {
      expect(firstCall.args[1]?.bind).to.deep.eq({
        sequelize_1: ':name'
      });
    }
  });
});
