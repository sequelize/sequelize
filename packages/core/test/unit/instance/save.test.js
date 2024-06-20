'use strict';

const { expect } = require('chai');
const { sequelize } = require('../../support');
const { DataTypes } = require('@sequelize/core');
const sinon = require('sinon');

describe('Model#save', () => {
  it('is not allowed if the instance does not have a primary key defined', async () => {
    const User = sequelize.define('User', {});
    const instance = User.build({}, { isNewRecord: false });

    await expect(instance.save()).to.be.rejectedWith(
      'You attempted to save an instance with no primary key, this is not allowed since it would result in a global update',
    );
  });

  describe('options tests', () => {
    let stub;

    before(() => {
      stub = sinon.stub(sequelize, 'queryRaw').resolves([
        {
          _previousDataValues: {},
          dataValues: { id: 1 },
        },
        1,
      ]);
    });

    after(() => {
      stub.restore();
    });

    it('should allow saves even if options are not given', () => {
      const User = sequelize.define('User', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
      });

      const instance = User.build({});
      expect(() => {
        instance.save();
      }).to.not.throw();
    });
  });
});
