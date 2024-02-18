'use strict';

const { expect } = require('chai');
const { EmptyResultError, UniqueConstraintError } = require('@sequelize/core');
const { beforeAll2, sequelize } = require('../../support');
const sinon = require('sinon');

describe('Model#findCreateFind', () => {
  const vars = beforeAll2(() => {
    const TestModel = sequelize.define('TestModel', {});

    return { TestModel };
  });

  beforeEach(function () {
    this.sinon = sinon.createSandbox();
  });

  afterEach(function () {
    this.sinon.restore();
  });

  it('should return the result of the first find call if not empty', async function () {
    const { TestModel } = vars;
    const result = {};
    const where = { prop: Math.random().toString() };
    const findSpy = this.sinon.stub(TestModel, 'findOne').resolves(result);

    await expect(
      TestModel.findCreateFind({
        where,
      }),
    ).to.eventually.eql([result, false]);

    expect(findSpy).to.have.been.calledOnce;
    expect(findSpy.getCall(0).args[0].where).to.equal(where);
  });

  it('should create if first find call is empty', async function () {
    const { TestModel } = vars;
    const result = {};
    const where = { prop: Math.random().toString() };
    const createSpy = this.sinon.stub(TestModel, 'create').resolves(result);

    this.sinon.stub(TestModel, 'findOne').resolves(null);

    await expect(
      TestModel.findCreateFind({
        where,
      }),
    ).to.eventually.eql([result, true]);

    expect(createSpy).to.have.been.calledWith(where);
  });

  for (const Error of [EmptyResultError, UniqueConstraintError]) {
    it(`should do a second find if create failed due to an error of type ${Error.name}`, async function () {
      const { TestModel } = vars;
      const result = {};
      const where = { prop: Math.random().toString() };
      const findSpy = this.sinon.stub(TestModel, 'findOne');

      this.sinon.stub(TestModel, 'create').rejects(new Error());

      findSpy.onFirstCall().resolves(null);
      findSpy.onSecondCall().resolves(result);

      await expect(
        TestModel.findCreateFind({
          where,
        }),
      ).to.eventually.eql([result, false]);

      expect(findSpy).to.have.been.calledTwice;
      expect(findSpy.getCall(1).args[0].where).to.equal(where);
    });
  }
});
