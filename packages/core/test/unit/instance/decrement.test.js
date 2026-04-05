'use strict';

const { expect } = require('chai');
const { sequelize } = require('../../support');
const { DataTypes } = require('@sequelize/core');
const sinon = require('sinon');

describe('Model#decrement', () => {
  it('is not allowed if the instance does not have a primary key defined', async () => {
    const User = sequelize.define('User', {});
    const instance = User.build({});

    await expect(instance.decrement()).to.be.rejectedWith(
      'but this model instance is missing the value of its primary key',
    );
  });

  describe('options tests', () => {
    let stub;
    before(() => {
      stub = sinon.stub(sequelize, 'queryRaw').resolves({
        _previousDataValues: { id: 3 },
        dataValues: { id: 1 },
      });
    });

    after(() => {
      stub.restore();
    });

    it('should allow decrements even if options are not given', async () => {
      const User = sequelize.define('User', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
      });

      const instance = User.build({ id: 3 }, { isNewRecord: false });
      await expect(instance.decrement(['id'])).to.be.fulfilled;
    });
  });
});
