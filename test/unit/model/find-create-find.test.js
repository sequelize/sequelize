'use strict';

const chai = require('chai'),
  expect = chai.expect,
  { EmptyResultError, UniqueConstraintError } = require('sequelize/lib/errors'),
  Support = require('../support'),
  current = Support.sequelize,
  sinon = require('sinon');

describe(Support.getTestDialectTeaser('Model'), () => {
  describe('findCreateFind', () => {
    const Model = current.define('Model', {});

    beforeEach(function() {
      this.sinon = sinon.createSandbox();
    });

    afterEach(function() {
      this.sinon.restore();
    });

    it('should return the result of the first find call if not empty', async function() {
      const result = {},
        where = { prop: Math.random().toString() },
        findSpy = this.sinon.stub(Model, 'findOne').resolves(result);

      await expect(Model.findCreateFind({
        where
      })).to.eventually.eql([result, false]);

      expect(findSpy).to.have.been.calledOnce;
      expect(findSpy.getCall(0).args[0].where).to.equal(where);
    });

    it('should create if first find call is empty', async function() {
      const result = {},
        where = { prop: Math.random().toString() },
        createSpy = this.sinon.stub(Model, 'create').resolves(result);

      this.sinon.stub(Model, 'findOne').resolves(null);

      await expect(Model.findCreateFind({
        where
      })).to.eventually.eql([result, true]);

      expect(createSpy).to.have.been.calledWith(where);
    });

    [EmptyResultError, UniqueConstraintError].forEach(Error => {
      it(`should do a second find if create failed due to an error of type ${Error.name}`, async function() {
        const result = {},
          where = { prop: Math.random().toString() },
          findSpy = this.sinon.stub(Model, 'findOne');

        this.sinon.stub(Model, 'create').rejects(new Error());

        findSpy.onFirstCall().resolves(null);
        findSpy.onSecondCall().resolves(result);

        await expect(Model.findCreateFind({
          where
        })).to.eventually.eql([result, false]);

        expect(findSpy).to.have.been.calledTwice;
        expect(findSpy.getCall(1).args[0].where).to.equal(where);
      });
    });
  });
});
