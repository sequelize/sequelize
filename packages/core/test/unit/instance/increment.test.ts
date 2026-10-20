import { DataTypes } from '@sequelize/core';
import { expect } from 'chai';
import sinon from 'sinon';
import { sequelize } from '../../support';

describe('Model#increment', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('is not allowed if the instance does not have a primary key defined', async () => {
    const User = sequelize.define('User', {});
    const instance = User.build({});

    // @ts-expect-error -- the primary key check happens before the arguments are validated
    await expect(instance.increment()).to.be.rejectedWith(
      'but this model instance is missing the value of its primary key',
    );
  });

  it('should allow increments even if options are not given', async () => {
    sinon.stub(sequelize, 'queryRaw').resolves([[], 0]);

    const User = sequelize.define('User', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
    });

    const instance = User.build({ id: 1 }, { isNewRecord: false });
    await expect(instance.increment(['id'])).to.be.fulfilled;
  });
});
