'use strict';

const chai = require('chai');

const expect = chai.expect;
const Support   = require('../support');

const current   = Support.sequelize;
const { DataTypes } = require('@sequelize/core');
const sinon     = require('sinon');

describe(Support.getTestDialectTeaser('Instance'), () => {
  describe('decrement', () => {
    describe('options tests', () => {
      let stub; let instance;
      const Model = current.define('User', {
        id: {
          type: DataTypes.BIGINT,
          primaryKey: true,
          autoIncrement: true,
        },
      });

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

      it('should allow decrements even if options are not given', () => {
        instance = Model.build({ id: 3 }, { isNewRecord: false });
        expect(() => {
          instance.decrement(['id']);
        }).to.not.throw();
      });
    });
  });
});
