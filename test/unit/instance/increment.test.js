'use strict';

const chai = require('chai');

const expect = chai.expect;
const Support   = require('../support');

const current   = Support.sequelize;
const Sequelize = Support.Sequelize;
const sinon     = require('sinon');

describe(Support.getTestDialectTeaser('Instance'), () => {
  describe('increment', () => {
    describe('options tests', () => {
      let stub; let instance;
      const Model = current.define('User', {
        id: {
          type: Sequelize.BIGINT,
          primaryKey: true,
          autoIncrement: true,
        },
      });

      before(() => {
        stub = sinon.stub(current, 'query').resolves(
          {
            _previousDataValues: { id: 1 },
            dataValues: { id: 3 },
          },
        );
      });

      after(() => {
        stub.restore();
      });

      it('should allow increments even if options are not given', () => {
        instance = Model.build({ id: 1 }, { isNewRecord: false });
        expect(() => {
          instance.increment(['id']);
        }).to.not.throw();
      });
    });
  });
});
