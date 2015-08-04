'use strict';

var chai = require('chai')
  , expect = chai.expect
  , Support   = require(__dirname + '/../support')
  , current   = Support.sequelize
  , Sequelize = Support.Sequelize
  , sinon     = require('sinon');

describe(Support.getTestDialectTeaser('Instance'), function() {
  describe('restore', function () {
    describe('options tests', function() {
      var stub
        , Model = current.define('User', {
          id: {
            type:          Sequelize.BIGINT,
            primaryKey:    true,
            autoIncrement: true,
          },
          deletedAt: {
            type:          Sequelize.DATE,
          }
        }, {
          paranoid: true
        })
        , instance;

      before(function() {
        stub = sinon.stub(current, 'query').returns(
          Sequelize.Promise.resolve({
            _previousDataValues: {id: 1},
            dataValues: {id: 2}
          })
        );
      });

      after(function() {
        stub.restore();
      });

      it('should allow restores even if options are not given', function () {
        instance = Model.build({id: 1}, {isNewRecord: false});
        expect(function () {
          instance.restore();
        }).to.not.throw();
      });

      it('should not modify options when it given to restore', function () {
        instance = Model.build({id: 1}, {isNewRecord: false});
        var options = { transaction: null };
        instance.restore(options);
        expect(options).to.deep.equal({ transaction: null });
      });
    });
  });

});
