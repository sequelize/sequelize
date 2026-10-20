import { DataTypes } from '@sequelize/core';
import { expect } from 'chai';
import sinon from 'sinon';
import { sequelize } from '../../support';

describe('Model#save', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('is not allowed if the instance does not have a primary key defined', async () => {
    const User = sequelize.define('User', {});
    const instance = User.build({}, { isNewRecord: false });

    await expect(instance.save()).to.be.rejectedWith(
      'You attempted to save an instance with no primary key, this is not allowed since it would result in a global update',
    );
  });

  it('should allow saves even if options are not given', async () => {
    // The typings of queryRaw don't cover the instance being returned when "instance" is set
    sinon.stub(sequelize, 'queryRaw').resolves([
      {
        _previousDataValues: {},
        dataValues: { id: 1 },
      },
      1,
    ] as any);

    const User = sequelize.define('User', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
    });

    const instance = User.build({});
    await expect(instance.save()).to.be.fulfilled;
  });
});
