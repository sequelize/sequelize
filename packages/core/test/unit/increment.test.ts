import { DataTypes } from '@sequelize/core';
import { expect } from 'chai';
import sinon from 'sinon';
import { beforeAll2, expectsql, sequelize } from '../support';

describe('Model.increment', () => {
  const vars = beforeAll2(() => {
    const User = sequelize.define('User', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      count: DataTypes.INTEGER,
    });

    const Account = sequelize.define(
      'Account',
      {
        number: DataTypes.INTEGER,
      },
      {
        version: 'lockVersion',
        underscored: true,
        timestamps: false,
      },
    );

    return { User, Account };
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should reject if options are missing', async () => {
    // @ts-expect-error -- we're testing that the missing options are rejected
    await expect(vars.User.increment(['id', 'count'])).to.be.rejectedWith(
      'Missing where attribute in the options parameter',
    );
  });

  it('should reject if options.where are missing', async () => {
    await expect(vars.User.increment(['id', 'count'], { by: 10 })).to.be.rejectedWith(
      'Missing where attribute in the options parameter',
    );
  });

  it('increments the version attribute using its column name', async () => {
    const stub = sinon.stub(sequelize, 'queryRaw').resolves([[], 0]);

    await vars.Account.increment('number', { where: { id: 1 } });

    expect(stub.callCount).to.eq(1);
    expectsql(stub.getCall(0).args[0], {
      default:
        'UPDATE [accounts] SET [number]=[number]+ 1,[lock_version]=[lock_version]+ 1 WHERE [id] = 1',
      mssql:
        'UPDATE [accounts] SET [number]=[number]+ 1,[lock_version]=[lock_version]+ 1 OUTPUT INSERTED.* WHERE [id] = 1',
      'postgres sqlite3':
        'UPDATE [accounts] SET [number]=[number]+ 1,[lock_version]=[lock_version]+ 1 WHERE [id] = 1 RETURNING *',
    });
  });
});
