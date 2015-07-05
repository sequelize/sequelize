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

      this.stub = stub(this.User.sequelize, 'transaction');
      this.stub.returns(new Promise(function () {}));
    });

    afterEach(function () {
      this.stub.restore();
    });

    it('should use transaction from cls if available', function () {
      var self = this;

      current.constructor.cls.run(function () {
        current.constructor.cls.set('transaction', { id: 123 });

        var options = {
          where : {
            name : 'John'
          }
        };

        self.User.findOrCreate(options);

        expect(options.transaction).to.have.property('id', 123);
      });
    });
  });
});
