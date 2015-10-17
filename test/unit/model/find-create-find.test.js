'use strict';

/* jshint -W030 */
var chai = require('chai')
  , expect = chai.expect
  , Support = require(__dirname + '/../support')
  , UniqueConstraintError = require(__dirname + '/../../../lib/errors').UniqueConstraintError
  , current = Support.sequelize
  , sinon = require('sinon')
  , Promise = require('bluebird');

describe(Support.getTestDialectTeaser('Model'), function() {
  describe('findCreateFind', function () {
    var Model = current.define('Model', {});

    beforeEach(function () {
      this.sinon = sinon.sandbox.create();
    });

    afterEach(function () {
      this.sinon.restore();
    });

    it('should return the result of the first find call if not empty', function () {
      var result = {}
        , where = {prop: Math.random().toString()}
        , findSpy = this.sinon.stub(Model, 'findOne').returns(Promise.resolve(result));

      return expect(Model.findCreateFind({
        where: where
      })).to.eventually.eql([result, false]).then(function () {
        expect(findSpy).to.have.been.calledOnce;
        expect(findSpy.getCall(0).args[0].where).to.equal(where);
      });
    });

    it('should create if first find call is empty', function () {
      var result = {}
        , where = {prop: Math.random().toString()}
        , createSpy = this.sinon.stub(Model, 'create').returns(Promise.resolve(result));

      this.sinon.stub(Model, 'findOne').returns(Promise.resolve(null));

      return expect(Model.findCreateFind({
        where: where
      })).to.eventually.eql([result, true]).then(function () {
        expect(createSpy).to.have.been.calledWith(where);
      });
    });

    it('should do a second find if create failed do to unique constraint', function () {
      var result = {}
        , where = {prop: Math.random().toString()}
        , findSpy = this.sinon.stub(Model, 'findOne');

      this.sinon.stub(Model, 'create').returns(Promise.reject(new UniqueConstraintError()));

      findSpy.onFirstCall().returns(Promise.resolve(null));
      findSpy.onSecondCall().returns(Promise.resolve(result));

      return expect(Model.findCreateFind({
        where: where
      })).to.eventually.eql([result, false]).then(function () {
        expect(findSpy).to.have.been.calledTwice;
        expect(findSpy.getCall(1).args[0].where).to.equal(where);
      });
    });
  });
});