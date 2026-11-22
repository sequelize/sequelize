import { DataTypes } from '@sequelize/core';
import { expect } from 'chai';
import type { SinonStub } from 'sinon';
import sinon from 'sinon';
import { sequelize } from '../../support';

describe('Model.destroy', () => {
  const User = sequelize.define('User', {
    name: DataTypes.STRING,
    secretValue: DataTypes.INTEGER,
  });

  let stubDelete: SinonStub;
  before(() => {
    stubDelete = sinon.stub(sequelize, 'queryRaw').resolves([[], 0]);
  });

  beforeEach(() => {
    stubDelete.resetHistory();
  });

  after(() => {
    stubDelete.restore();
  });

  it('can detect complex objects', async () => {
    class Where {
      secretValue = '1';
    }

    await expect(
      User.destroy({
        // @ts-expect-error -- testing that class instances are rejected
        where: new Where(),
      }),
    ).to.be.rejectedWith('Invalid value received for the "where" option.');
  });
});
