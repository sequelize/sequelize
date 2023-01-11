'use strict';

const chai = require('chai');

const expect = chai.expect;
const Support   = require('../../support');

const current   = Support.sequelize;
const { DataTypes } = require('@sequelize/core');
const sinon     = require('sinon');

describe(Support.getTestDialectTeaser('Instance'), () => {
  describe('decrement', () => {
    it('is not allowed if the instance does not have a primary key defined', async () => {
      const User = current.define('User', {});
      const instance = User.build({});

      await expect(instance.decrement()).to.be.rejectedWith('but this model instance is missing the value of its primary key');
    });

    describe('options tests', () => {
      const Model = current.define('User', {
        id: {
          type: DataTypes.BIGINT,
          primaryKey: true,
          autoIncrement: true,
        },
      });

      let stub;
      before(() => {
        stub = sinon.stub(current, 'queryRaw').resolves(
          {
            _previousDataValues: { id: 3 },
            dataValues: { id: 1 },
          },
        );
      });

      after(() => {
        stub.restore();
      });

      it('should allow decrements even if options are not given', async () => {
        const instance = Model.build({ id: 3 }, { isNewRecord: false });
        await expect(instance.decrement(['id'])).to.be.fulfilled;
      });
    });
  });
});
