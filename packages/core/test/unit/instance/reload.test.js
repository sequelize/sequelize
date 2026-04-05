'use strict';

const { expect } = require('chai');
const { sequelize } = require('../../support');
const { DataTypes } = require('@sequelize/core');
const sinon = require('sinon');

describe('Model#reload', () => {
  it('is not allowed if the instance does not have a primary key defined', async () => {
    const User = sequelize.define('User', {});
    const instance = User.build({});

    await expect(instance.reload()).to.be.rejectedWith(
      'but this model instance is missing the value of its primary key',
    );
  });

  describe('options tests', () => {
    let stub;

    before(() => {
      stub = sinon.stub(sequelize, 'queryRaw').resolves({
        _previousDataValues: { id: 1 },
        dataValues: { id: 2 },
      });
    });

    after(() => {
      stub.restore();
    });

    it('should allow reloads even if options are not given', async () => {
      const User = sequelize.define(
        'User',
        {
          id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
          },
          deletedAt: {},
        },
        {
          paranoid: true,
        },
      );

      const instance = User.build({ id: 1 }, { isNewRecord: false });
      await expect(instance.reload()).to.be.fulfilled;
    });
  });
});
