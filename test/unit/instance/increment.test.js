'use strict';

var chai = require('chai')
  , expect = chai.expect
  , Support   = require(__dirname + '/../support')
  , current   = Support.sequelize
  , Sequelize = Support.Sequelize
  , sinon     = require('sinon');

describe(Support.getTestDialectTeaser('Instance'), function() {
  describe('increment', function () {
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
            _previousDataValues: {id: 1},
            dataValues: {id: 3}
          })
        );
      });

      after(function() {
        stub.restore();
      });

      it('should throw error if options.fields are missing', function () {
        instance = Model.build({id: 1}, {isNewRecord: false});
        expect(function () {
          instance.increment(['id']);
        }).to.throw('Increment was refactored to use options only. Pass fields via `options.fields` option.');
      });
    });
  });
});
