import { DataTypes } from '@sequelize/core';
import { expect } from 'chai';
import sinon from 'sinon';
import { expectsql, sequelize } from '../../support';

describe('QueryInterface#delete', () => {
  const User = sequelize.define('User', {
    firstName: DataTypes.STRING,
  }, { timestamps: false });

  afterEach(() => {
    sinon.restore();
  });

  // you'll find more replacement tests in query-generator tests
  it('does not parse replacements outside of raw sql', async () => {
    const stub = sinon.stub(sequelize, 'queryRaw');

    const instance = new User();

    await sequelize.getQueryInterface().delete(
      instance,
      User.tableName,
      { id: ':id' },
      {
        replacements: {
          limit: 1,
          id: '123',
        },
      },
    );

    expect(stub.callCount).to.eq(1);
    const firstCall = stub.getCall(0);
    expectsql(firstCall.args[0] as string, {
      default: `DELETE FROM [Users] WHERE [id] = ':id'`,
      mssql: `DELETE FROM [Users] WHERE [id] = N':id'; SELECT @@ROWCOUNT AS AFFECTEDROWS;`,
    });

    expect(firstCall.args[1]?.bind).to.be.undefined;
  });

  it('returns query with `options.returning` set to true', async () => {
    const stub = sinon.stub(sequelize, 'queryRaw');
    const instance = new User();

    await sequelize.getQueryInterface().delete(
      instance,
      User.tableName,
      { id: ':id' },
      {
        returning: true,
        replacements: {
          id: '123',
        },
      },
    );

    expect(stub.callCount).to.eq(1);
    const firstCall = stub.getCall(0);
    expectsql(firstCall.args[0] as string, {
      default: 'DELETE FROM `Users` WHERE `id` = \':id\'',
      postgres: `DELETE FROM "Users" WHERE "id" = ':id' RETURNING "id","firstName"`,
      mssql: `DELETE FROM [Users] WHERE [id] = N':id'; SELECT @@ROWCOUNT AS AFFECTEDROWS;`,
      snowflake: `DELETE FROM "Users" WHERE "id" = ':id'`,
      db2: `DELETE FROM "Users" WHERE "id" = ':id'`,
      ibmi: `DELETE FROM "Users" WHERE "id" = ':id'`,
    });
  });

  it('returns query with fields specified in `options.returning`', async () => {
    const stub = sinon.stub(sequelize, 'queryRaw');
    const instance = new User();

    await sequelize.getQueryInterface().delete(
      instance,
      User.tableName,
      { id: ':id' },
      {
        returning: ['firstName'],
        replacements: {
          id: '123',
        },
      },
    );

    expect(stub.callCount).to.eq(1);
    const firstCall = stub.getCall(0);
    expectsql(firstCall.args[0] as string, {
      default: 'DELETE FROM `Users` WHERE `id` = \':id\'',
      postgres: `DELETE FROM "Users" WHERE "id" = ':id' RETURNING "firstName"`,
      mssql: `DELETE FROM [Users] WHERE [id] = N':id'; SELECT @@ROWCOUNT AS AFFECTEDROWS;`,
      snowflake: `DELETE FROM "Users" WHERE "id" = ':id'`,
      db2: `DELETE FROM "Users" WHERE "id" = ':id'`,
      ibmi: `DELETE FROM "Users" WHERE "id" = ':id'`,
    });
  });

  it('returns query with `options.returning` set to false', async () => {
    const stub = sinon.stub(sequelize, 'queryRaw');
    const instance = new User();

    await sequelize.getQueryInterface().delete(
      instance,
      User.tableName,
      { id: ':id' },
      {
        returning: false,
        replacements: {
          id: '123',
        },
      },
    );

    expect(stub.callCount).to.eq(1);
    const firstCall = stub.getCall(0);
    expectsql(firstCall.args[0] as string, {
      default: 'DELETE FROM `Users` WHERE `id` = \':id\'',
      postgres: `DELETE FROM "Users" WHERE "id" = ':id'`,
      mssql: `DELETE FROM [Users] WHERE [id] = N':id'; SELECT @@ROWCOUNT AS AFFECTEDROWS;`,
      snowflake: `DELETE FROM "Users" WHERE "id" = ':id'`,
      db2: `DELETE FROM "Users" WHERE "id" = ':id'`,
      ibmi: `DELETE FROM "Users" WHERE "id" = ':id'`,
    });
  });
});
