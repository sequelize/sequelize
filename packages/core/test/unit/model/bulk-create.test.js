'use strict';

const { expect } = require('chai');
const sinon = require('sinon');
const { beforeAll2, sequelize } = require('../../support');
const { DataTypes } = require('@sequelize/core');
const { logger } = require('@sequelize/core/_non-semver-use-at-your-own-risk_/utils/logger.js');

describe('Model#bulkCreate', () => {
  const vars = beforeAll2(() => {
    const TestModel = sequelize.define(
      'TestModel',
      {
        accountId: {
          type: DataTypes.INTEGER(11).UNSIGNED,
          allowNull: false,
          field: 'account_id',
        },
        purchaseCount: {
          type: DataTypes.INTEGER(11).UNSIGNED,
          allowNull: false,
          underscored: true,
        },
      },
      { timestamps: false },
    );

    const stub = sinon.stub(sequelize.queryInterface, 'bulkInsert').resolves([]);
    const warnStub = sinon.stub(logger, 'warn');

    return { TestModel, stub, warnStub };
  });

  afterEach(() => {
    vars.stub.resetHistory();
    vars.warnStub.resetHistory();
  });

  after(() => {
    vars.stub.restore();
    vars.warnStub.restore();
  });

  describe('validations', () => {
    it('should not fail for renamed fields', async () => {
      const { stub, TestModel } = vars;

      await TestModel.bulkCreate([{ accountId: 42, purchaseCount: 4 }], {
        validate: true,
      });

      expect(stub.getCall(0).args[1]).to.deep.equal([
        { account_id: 42, purchaseCount: 4, id: null },
      ]);
      expect(vars.warnStub).not.to.have.been.called;
    });

    if (sequelize.dialect.supports.inserts.updateOnDuplicate) {
      for (const conflictAttributes of [true, []]) {
        it(`should reject invalid conflictAttributes ${JSON.stringify(conflictAttributes)}`, async () => {
          const { stub, TestModel } = vars;

          await expect(
            TestModel.bulkCreate([{ accountId: 42, purchaseCount: 3 }], {
              conflictAttributes,
              updateOnDuplicate: ['purchaseCount'],
            }),
          ).to.be.rejectedWith(Error, 'conflictAttributes option must be a non-empty array.');

          expect(stub).not.to.have.been.called;
        });
      }

      it('should map conflictAttributes to column names', async () => {
        const { stub, TestModel } = vars;

        // Note that the model also has an id key as its primary key.
        await TestModel.bulkCreate([{ accountId: 42, purchaseCount: 3 }], {
          conflictAttributes: ['accountId'],
          updateOnDuplicate: ['purchaseCount'],
        });

        expect(
          // Not worth checking that the reference of the array matches - just the contents.
          stub.getCall(0).args[2].upsertKeys,
        ).to.deep.equal(['account_id']);
        expect(vars.warnStub).not.to.have.been.called;
      });
    }
  });

  it('should warn when conflictAttributes is set without updateOnDuplicate', async () => {
    const { stub, TestModel, warnStub } = vars;

    await TestModel.bulkCreate([{ accountId: 42, purchaseCount: 3 }], {
      conflictAttributes: ['accountId'],
    });

    expect(warnStub).to.have.been.calledOnceWithExactly(
      'conflictAttributes option is ignored because updateOnDuplicate is not set',
    );
    expect(stub).to.have.been.calledOnce;
  });
});
