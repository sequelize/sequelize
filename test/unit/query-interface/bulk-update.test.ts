import { DataTypes } from '@sequelize/core';
import { expect } from 'chai';
import sinon from 'sinon';
import { expectsql, sequelize } from '../../support';

describe('QueryInterface#bulkUpdate', () => {
  const User = sequelize.define('User', {
    firstName: DataTypes.STRING,
  }, { timestamps: false });

  afterEach(() => {
    sinon.restore();
  });

  // you'll find more replacement tests in query-generator tests
  it('does not parse replacements outside of raw sql', async () => {
    const stub = sinon.stub(sequelize, 'queryRaw').resolves([[], 0]);

    await sequelize.getQueryInterface().bulkUpdate(
      User.tableName,
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
    expectsql(firstCall.args[0] as string, {
      postgres: `UPDATE "Users" SET "firstName"=$1 WHERE "firstName" = $2;`,
      mariadb: 'UPDATE `Users` SET `firstName`=? WHERE `firstName` = ?;',
      mysql: 'UPDATE `Users` SET `firstName`=? WHERE `firstName` = ?;',
    });

    expect(firstCall.args[1]?.bind).to.deep.eq([':injection', ':injection']);
  });

  it('does not parse bind parameters outside of raw sql', async () => {
    const stub = sinon.stub(sequelize, 'queryRaw').resolves([[], 0]);

    await sequelize.getQueryInterface().bulkUpdate(
      User.tableName,
      {
        firstName: '$injection',
      },
      {
      // where
        firstName: '$injection',
      },
      {
        bind: {
          injection: 'raw sql',
        },
      },
    );

    expect(stub.callCount).to.eq(1);
    const firstCall = stub.getCall(0);
    expectsql(firstCall.args[0] as string, {
      postgres: `UPDATE "Users" SET "firstName"=$1 WHERE "firstName" = $2;`,
      mariadb: 'UPDATE `Users` SET `firstName`=? WHERE `firstName` = ?;',
      mysql: 'UPDATE `Users` SET `firstName`=? WHERE `firstName` = ?;',
    });

    expect(firstCall.args[1]?.bind).to.deep.eq(['$injection', '$injection']);
  });
});
