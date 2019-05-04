'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support   = require('../support'),
  current   = Support.sequelize,
  Sequelize = Support.Sequelize,
  sinon     = require('sinon');

describe(Support.getTestDialectTeaser('Instance'), () => {
  describe('save', () => {
    it('should disallow saves if no primary key values is present', () => {
      const Model = current.define('User', {

        }),
        instance = new Model({}, { isNewRecord: false });

      expect(() => {
        instance.save();
      }).to.throw();
    });

    describe('options tests', () => {
      let stub, instance;
      const Model = current.define('User', {
        id: {
          type: Sequelize.BIGINT,
          primaryKey: true,
          autoIncrement: true
        }
      });

      before(() => {
        stub = sinon.stub(current, 'query').resolves(
          [{
            _previousDataValues: {},
            dataValues: { id: 1 }
          }, 1]
        );
      });

      after(() => {
        stub.restore();
      });

      it('should allow saves even if options are not given', () => {
        instance = new Model({});
        expect(() => {
          instance.save();
        }).to.not.throw();
      });
    });
  });
});
