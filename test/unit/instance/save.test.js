'use strict';

const chai = require('chai');

const expect = chai.expect;
const Support   = require('../support');

const current   = Support.sequelize;
const { DataTypes } = require('@sequelize/core');
const sinon     = require('sinon');

describe(Support.getTestDialectTeaser('Instance'), () => {
  describe('save', () => {
    it('is not allowed if the instance does not have a primary key defined', async () => {
      const User = current.define('User', {});
      const instance = User.build({});

      await expect(instance.save()).to.be.rejectedWith('but this model instance is missing the value of its primary key');
    });

    describe('options tests', () => {
      let stub;
      let instance;
      const Model = current.define('User', {
        id: {
          type: DataTypes.BIGINT,
          primaryKey: true,
          autoIncrement: true,
        },
      });

      before(() => {
        stub = sinon.stub(current, 'queryRaw').resolves(
          [{
            _previousDataValues: {},
            dataValues: { id: 1 },
          }, 1],
        );
      });

      after(() => {
        stub.restore();
      });

      it('should allow saves even if options are not given', () => {
        instance = Model.build({});
        expect(() => {
          instance.save();
        }).to.not.throw();
      });
    });
  });
});
