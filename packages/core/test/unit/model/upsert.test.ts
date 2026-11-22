import { DataTypes } from '@sequelize/core';
import { expect } from 'chai';
import type { SinonStub } from 'sinon';
import sinon from 'sinon';
import { beforeAll2, sequelize } from '../../support';

describe('Model.upsert', () => {
  if (!sequelize.dialect.supports.upserts) {
    return;
  }

  const vars = beforeAll2(() => {
    const User = sequelize.define('User', {
      name: DataTypes.STRING,
      virtualValue: {
        type: DataTypes.VIRTUAL,
        set(val) {
          this.set('value', val);
        },
        get() {
          return this.get('value');
        },
      },
      value: DataTypes.STRING,
      secretValue: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      createdAt: {
        type: DataTypes.DATE,
        field: 'created_at',
      },
    });

    const UserNoTime = sequelize.define(
      'UserNoTime',
      {
        name: DataTypes.STRING,
      },
      {
        timestamps: false,
      },
    );

    return { User, UserNoTime };
  });

  let query: SinonStub;
  let stub: SinonStub;
  beforeEach(() => {
    query = sinon.stub(sequelize, 'queryRaw').resolves();
    stub = sinon.stub(sequelize.queryInterface, 'upsert').resolves([vars.User.build(), true]);
  });

  afterEach(() => {
    query.restore();
    stub.restore();
  });

  it('skip validations for missing fields', async () => {
    await expect(
      vars.User.upsert({
        name: 'Grumpy Cat',
      }),
    ).to.be.fulfilled;
  });

  it('creates new record with correct field names', async () => {
    await vars.User.upsert({
      name: 'Young Cat',
      virtualValue: '999',
    });

    expect(Object.keys(stub.getCall(0).args[1])).to.deep.equal([
      'name',
      'value',
      'created_at',
      'updatedAt',
    ]);
  });

  it('creates new record with timestamps disabled', async () => {
    await vars.UserNoTime.upsert({
      name: 'Young Cat',
    });

    expect(Object.keys(stub.getCall(0).args[1])).to.deep.equal(['name']);
  });

  it('updates all changed fields by default', async () => {
    await vars.User.upsert({
      name: 'Old Cat',
      virtualValue: '111',
    });

    expect(Object.keys(stub.getCall(0).args[2])).to.deep.equal(['name', 'value', 'updatedAt']);
  });
});
