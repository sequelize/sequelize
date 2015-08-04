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

      it('should allow increments even if options are not given', function () {
        instance = Model.build({id: 1}, {isNewRecord: false});
        expect(function () {
          instance.increment(['id']);
        }).to.not.throw();
      });

      it('should not modify options when it given to increment', function () {
        instance = Model.build({id: 1}, {isNewRecord: false});
        var options = { by: 2 };
        instance.increment(['id'], options);
        expect(options).to.deep.equal({ by: 2 });
      });
    });
  });
});
