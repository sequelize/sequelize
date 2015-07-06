'use strict';

/* jshint -W030 */
var chai = require('chai')
  , expect = chai.expect
  , Support = require(__dirname + '/../support')
  , current = Support.sequelize
  , cls = require('continuation-local-storage')
  , sinon = require('sinon')
  , stub = sinon.stub
  , Promise = require('bluebird');

describe(Support.getTestDialectTeaser('Model'), function() {

  describe('method findOrCreate', function () {

    before(function () {
      current.constructor.cls = cls.createNamespace('sequelize');
    });

    after(function () {
      delete current.constructor.cls;
    });

    beforeEach(function () {
      this.User = current.define('User', {}, {
        name: 'John'
      });

      this.transactionStub = stub(this.User.sequelize, 'transaction');
      this.transactionStub.returns(new Promise(function () {}));

      this.clsStub = stub(current.constructor.cls, 'get');
      this.clsStub.returns({ id: 123 });
    });

    afterEach(function () {
      this.transactionStub.restore();
      this.clsStub.restore();
    });

    it('should use transaction from cls if available', function () {

      var options = {
        where : {
          name : 'John'
        }
      };

      this.User.findOrCreate(options);

      expect(this.clsStub.calledOnce).to.equal(true, 'expected to ask for transaction');
    });

    it('should not use transaction from cls if provided as argument', function () {

      var options = {
        where : {
          name : 'John'
        },
        transaction : { id : 123 }
      };

      this.User.findOrCreate(options);

      expect(this.clsStub.called).to.equal(false);
    });
  });
});
