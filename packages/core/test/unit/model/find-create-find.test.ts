import { EmptyResultError, UniqueConstraintError } from '@sequelize/core';
import { expect } from 'chai';
import sinon from 'sinon';
import { beforeAll2, sequelize } from '../../support';

describe('Model#findCreateFind', () => {
  const vars = beforeAll2(() => {
    const TestModel = sequelize.define('TestModel', {});

    return { TestModel };
  });

  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  it('should return the result of the first find call if not empty', async () => {
    const { TestModel } = vars;
    const result = TestModel.build();
    const where = { prop: Math.random().toString() };
    const findSpy = sandbox.stub(TestModel, 'findOne').resolves(result);

    await expect(
      TestModel.findCreateFind({
        where,
      }),
    ).to.eventually.eql([result, false]);

    expect(findSpy).to.have.been.calledOnce;
    expect(findSpy.getCall(0).args[0]?.where).to.equal(where);
  });

  it('should create if first find call is empty', async () => {
    const { TestModel } = vars;
    const result = TestModel.build();
    const where = { prop: Math.random().toString() };
    const createSpy = sandbox.stub(TestModel, 'create').resolves(result);

    sandbox.stub(TestModel, 'findOne').resolves(null);

    await expect(
      TestModel.findCreateFind({
        where,
      }),
    ).to.eventually.eql([result, true]);

    expect(createSpy).to.have.been.calledWith(where);
  });

  for (const Error of [EmptyResultError, UniqueConstraintError]) {
    it(`should do a second find if create failed due to an error of type ${Error.name}`, async () => {
      const { TestModel } = vars;
      const result = TestModel.build();
      const where = { prop: Math.random().toString() };
      const findSpy = sandbox.stub(TestModel, 'findOne');

      // @ts-expect-error -- EmptyResultError requires a message, which this test does not need
      sandbox.stub(TestModel, 'create').rejects(new Error());

      findSpy.onFirstCall().resolves(null);
      findSpy.onSecondCall().resolves(result);

      await expect(
        TestModel.findCreateFind({
          where,
        }),
      ).to.eventually.eql([result, false]);

      expect(findSpy).to.have.been.calledTwice;
      expect(findSpy.getCall(1).args[0]?.where).to.equal(where);
    });
  }
});
