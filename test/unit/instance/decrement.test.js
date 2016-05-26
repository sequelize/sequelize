'use strict';

var chai = require('chai')
  , expect = chai.expect
  , Support   = require(__dirname + '/../support')
  , current   = Support.sequelize
  , Sequelize = Support.Sequelize
  , sinon     = require('sinon');

describe(Support.getTestDialectTeaser('Instance'), function() {
  describe('decrement', function () {
    describe('options tests', function() {
      var stub
        , Model = current.define('User', {
          id: {
            type:          Sequelize.BIGINT,
            primaryKey:    true,
            autoIncrement: true,
          }
        })
        , instance;

      before(function() {
        stub = sinon.stub(current, 'query').returns(
          Sequelize.Promise.resolve({
            _previousDataValues: {id: 3},
            dataValues: {id: 1}
          })
        );
      });

      after(function() {
        stub.restore();
      });

      it('should allow decrements even if options are not given', function () {
        instance = Model.build({id: 3}, {isNewRecord: false});
        expect(function () {
          instance.decrement(['id']);
        }).to.not.throw();
      });
    });
  });
});
