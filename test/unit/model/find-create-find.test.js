'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require('../support'),
  UniqueConstraintError = require('../../../lib/errors').UniqueConstraintError,
  current = Support.sequelize,
  sinon = require('sinon'),
  Promise = require('bluebird');

describe(Support.getTestDialectTeaser('Model'), () => {
  describe('findCreateFind', () => {
    const Model = current.define('Model', {});

    beforeEach(function() {
      this.sinon = sinon.createSandbox();
      this.sinon.usingPromise(Promise);
    });

    afterEach(function() {
      this.sinon.restore();
    });

    it('should return the result of the first find call if not empty', function() {
      const result = {},
        where = { prop: Math.random().toString() },
        findSpy = this.sinon.stub(Model, 'findOne').resolves(result);

      return expect(Model.findCreateFind({
        where
      })).to.eventually.eql([result, false]).then(() => {
        expect(findSpy).to.have.been.calledOnce;
        expect(findSpy.getCall(0).args[0].where).to.equal(where);
      });
    });

    it('should create if first find call is empty', function() {
      const result = {},
        where = { prop: Math.random().toString() },
        createSpy = this.sinon.stub(Model, 'create').resolves(result);

      this.sinon.stub(Model, 'findOne').resolves(null);

      return expect(Model.findCreateFind({
        where
      })).to.eventually.eql([result, true]).then(() => {
        expect(createSpy).to.have.been.calledWith(where);
      });
    });

    it('should do a second find if create failed do to unique constraint', function() {
      const result = {},
        where = { prop: Math.random().toString() },
        findSpy = this.sinon.stub(Model, 'findOne');

      this.sinon.stub(Model, 'create').rejects(new UniqueConstraintError());

      findSpy.onFirstCall().resolves(null);
      findSpy.onSecondCall().resolves(result);

      return expect(Model.findCreateFind({
        where
      })).to.eventually.eql([result, false]).then(() => {
        expect(findSpy).to.have.been.calledTwice;
        expect(findSpy.getCall(1).args[0].where).to.equal(where);
      });
    });
  });
});
