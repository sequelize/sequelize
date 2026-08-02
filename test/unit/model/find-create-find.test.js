import { UniqueConstraintError } from '../../../lib/errors.js';
import * as chai from 'chai';
import Support from '../support.js';
import sinon from 'sinon';

const expect = chai.expect;

const current = Support.sequelize;

describe(Support.getTestDialectTeaser('Model'), () => {
  describe('findCreateFind', () => {
    const Model = current.define('Model', {});

    beforeEach(function () {
      this.sinon = sinon.createSandbox();
    });

    afterEach(function () {
      this.sinon.restore();
    });

    it('should return the result of the first find call if not empty', function () {
      const result = {},
        where = { prop: Math.random().toString() },
        findSpy = this.sinon.stub(Model, 'findOne').returns(Promise.resolve(result));

      return expect(
        Model.findCreateFind({
          where
        })
      )
        .to.eventually.eql([result, false])
        .then(() => {
          expect(findSpy.calledOnce).to.be.true;
          expect(findSpy.getCall(0).args[0].where).to.equal(where);
        });
    });

    it('should create if first find call is empty', function () {
      const result = {},
        where = { prop: Math.random().toString() },
        createSpy = this.sinon.stub(Model, 'create').returns(Promise.resolve(result));

      this.sinon.stub(Model, 'findOne').returns(Promise.resolve(null));

      return expect(
        Model.findCreateFind({
          where
        })
      )
        .to.eventually.eql([result, true])
        .then(() => {
          expect(createSpy.calledWith(where), 'createSpy should have been called with expected arguments').to.be.true;
        });
    });

    it('should do a second find if create failed do to unique constraint', function () {
      const result = {},
        where = { prop: Math.random().toString() },
        findSpy = this.sinon.stub(Model, 'findOne');

      this.sinon.stub(Model, 'create').callsFake(() => {
        return Promise.reject(new UniqueConstraintError());
      });

      findSpy.onFirstCall().returns(Promise.resolve(null));
      findSpy.onSecondCall().returns(Promise.resolve(result));

      return expect(
        Model.findCreateFind({
          where
        })
      )
        .to.eventually.eql([result, false])
        .then(() => {
          expect(findSpy.calledTwice).to.be.true;
          expect(findSpy.getCall(1).args[0].where).to.equal(where);
        });
    });
  });
});
