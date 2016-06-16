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
    });

    describe('attributes mapping tests', function() {
      var stub
        , Model = current.define('User', {
        id: {
          type:          Sequelize.BIGINT,
          primaryKey:    true,
          autoIncrement: true,
        },
        incrementedAt: {
          field: 'incremented_at',
          type: Sequelize.DATE,
        },
        updatedAt: {
          field: 'updated_at',
          type: Sequelize.DATE,
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

      it('should map updated_at and other attributes names', function() {
        instance = Model.build({id: 1}, {isNewRecord: false});
        expect(function() {
          instance.increment(['id'], {attributes: {incrementedAt: new Date()}});
        }).to.not.throw();

        expect(stub.calledOnce).to.be.true;

        var options = stub.getCall(0).args[1];
        expect(options).to.be.an('object').with.property('attributes');

        var attributes = options.attributes;
        expect(attributes).to.be.an('object');
        expect(attributes).to.have.property('incremented_at');
        expect(attributes).to.have.property('updated_at');
        expect(attributes).to.not.have.property('incrementedAt');
        expect(attributes).to.not.have.property('updatedAt');
      });
    })
  });
});
