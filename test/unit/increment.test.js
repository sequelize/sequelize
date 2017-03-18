'use strict';

var chai = require('chai')
  , expect = chai.expect
  , Support   = require(__dirname + '/../support')
  , current   = Support.sequelize
  , Sequelize = Support.Sequelize
  , sinon     = require('sinon');

describe(Support.getTestDialectTeaser('Model'), function() {
  describe('increment', function () {
    describe('options tests', function() {
      var stub
        , Model = current.define('User', {
          id: {
            type:          Sequelize.BIGINT,
            primaryKey:    true,
            autoIncrement: true,
          },
          count: Sequelize.BIGINT,
        });

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
        expect(function () {
          Model.increment(['id', 'count'], {
            by: 10,
            where: {
              id: {
                $gt: 0
              }
            }
          });
        }).to.not.throw();
      });
    });
  });
});
