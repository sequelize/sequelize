'use strict';

var chai = require('chai')
  , expect = chai.expect
  , Support   = require(__dirname + '/../support')
  , current   = Support.sequelize
  , Sequelize = Support.Sequelize
  , sinon     = require('sinon');

describe(Support.getTestDialectTeaser('Instance'), function() {
  describe('save', function () {
    it('should disallow saves if no primary key values is present', function () {
      var Model = current.define('User', {

      })
        , instance;

      instance = Model.build({}, {isNewRecord: false});

      expect(function () {
        instance.save();
      }).to.throw();
    });

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
            _previousDataValues: {},
            dataValues: {id: 1}
          })
        );
      });

      after(function() {
        stub.restore();
      });

      it('should allow saves even if options are not given', function () {
        instance = Model.build({});
        expect(function () {
          instance.save();
        }).to.not.throw();
      });
    });
  });
});
