'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support   = require(__dirname + '/../support'),
  current   = Support.sequelize,
  Sequelize = Support.Sequelize,
  sinon     = require('sinon');

describe(Support.getTestDialectTeaser('Instance'), () => {
  describe('reload', () => {
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
        stub = sinon.stub(current, 'query').returns(
          Sequelize.Promise.resolve({
            _previousDataValues: {id: 1},
            dataValues: {id: 2}
          })
        );
      });

      after(() => {
        stub.restore();
      });

      it('should allow reloads even if options are not given', () => {
        instance = Model.build({id: 1}, {isNewRecord: false});
        expect(() => {
          instance.reload();
        }).to.not.throw();
      });
    });
  });
});
