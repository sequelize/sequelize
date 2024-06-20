'use strict';

const { expect } = require('chai');
const { sequelize } = require('../../support');
const { DataTypes } = require('@sequelize/core');
const sinon = require('sinon');

describe('Model#restore', () => {
  it('is not allowed if the instance does not have a primary key defined', async () => {
    const User = sequelize.define('User', {}, { paranoid: true });
    const instance = User.build({}, { isNewRecord: false });

    await expect(instance.restore()).to.be.rejectedWith(
      'save an instance with no primary key, this is not allowed since it would',
    );
  });

  describe('options tests', () => {
    let stub;

    before(() => {
      stub = sinon.stub(sequelize, 'queryRaw').resolves([
        {
          _previousDataValues: { id: 1 },
          dataValues: { id: 2 },
        },
        1,
      ]);
    });

    after(() => {
      stub.restore();
    });

    it('should allow restores even if options are not given', () => {
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
      expect(() => {
        instance.restore();
      }).to.not.throw();
    });
  });
});
