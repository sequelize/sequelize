'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support   = require('../support'),
  current   = Support.sequelize,
  Sequelize = Support.Sequelize,
  sinon     = require('sinon');

describe(Support.getTestDialectTeaser('Instance'), () => {
  describe('restore', () => {
    describe('options tests', () => {
      let stub, instance;
      const Model = current.define('User', {
        id: {
          type: Sequelize.BIGINT,
          primaryKey: true,
          autoIncrement: true
        },
        deletedAt: {
          type: Sequelize.DATE
        }
      }, {
        paranoid: true
      });

      before(() => {
        stub = sinon.stub(current, 'query').resolves(
          [{
            _previousDataValues: { id: 1 },
            dataValues: { id: 2 }
          }, 1]
        );
      });

      after(() => {
        stub.restore();
      });

      it('should allow restores even if options are not given', () => {
        instance = new Model({ id: 1 }, { isNewRecord: false });
        expect(() => {
          instance.restore();
        }).to.not.throw();
      });
    });
  });
});
