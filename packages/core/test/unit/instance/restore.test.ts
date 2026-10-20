import { DataTypes } from '@sequelize/core';
import { expect } from 'chai';
import sinon from 'sinon';
import { sequelize } from '../../support';

describe('Model#restore', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('is not allowed if the instance does not have a primary key defined', async () => {
    const User = sequelize.define('User', {}, { paranoid: true });
    const instance = User.build({}, { isNewRecord: false });

    await expect(instance.restore()).to.be.rejectedWith(
      'save an instance with no primary key, this is not allowed since it would',
    );
  });

  it('should allow restores even if options are not given', async () => {
    // The typings of queryRaw don't cover the instance being returned when "instance" is set
    sinon.stub(sequelize, 'queryRaw').resolves([
      {
        _previousDataValues: { id: 1 },
        dataValues: { id: 2 },
      },
      1,
    ] as any);

    const User = sequelize.define(
      'User',
      {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
      },
      {
        paranoid: true,
      },
    );

    const instance = User.build({ id: 1 }, { isNewRecord: false });
    await expect(instance.restore()).to.be.fulfilled;
  });
});
