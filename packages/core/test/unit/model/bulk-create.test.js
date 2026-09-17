'use strict';

const { expect } = require('chai');
const sinon = require('sinon');
const { beforeAll2, sequelize } = require('../../support');
const { DataTypes, ParameterStyle } = require('@sequelize/core');

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

    return { TestModel, stub };
  });

  afterEach(() => {
    vars.stub.resetHistory();
  });

  after(() => {
    vars.stub.restore();
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
    });

    if (sequelize.dialect.supports.inserts.updateOnDuplicate) {
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
      });
    }
  });

  describe('parameterStyle', () => {
    const { bulkInsertParameterStyles } = sequelize.dialect.supports.inserts;
    const unsupportedStyle = [ParameterStyle.REPLACEMENT, ParameterStyle.BIND].find(
      style => !bulkInsertParameterStyles[style],
    );

    if (unsupportedStyle) {
      it(`rejects parameterStyle ${unsupportedStyle} before running hooks`, async () => {
        const { stub, TestModel } = vars;
        const hook = sinon.spy();
        TestModel.hooks.addListener('beforeBulkCreate', hook);

        try {
          await expect(
            TestModel.bulkCreate([{ accountId: 42, purchaseCount: 4 }], {
              parameterStyle: unsupportedStyle,
            }),
          ).to.be.rejectedWith(
            Error,
            `does not support the parameterStyle "${unsupportedStyle}" option for bulkCreate`,
          );
        } finally {
          TestModel.hooks.removeListener('beforeBulkCreate', hook);
        }

        expect(hook.callCount).to.eq(0);
        expect(stub.callCount).to.eq(0);
      });
    }

    it('forwards a supported parameterStyle to bulkInsert', async () => {
      const { stub, TestModel } = vars;
      const style = bulkInsertParameterStyles[ParameterStyle.BIND]
        ? ParameterStyle.BIND
        : ParameterStyle.REPLACEMENT;

      await TestModel.bulkCreate([{ accountId: 42, purchaseCount: 4 }], {
        parameterStyle: style,
      });

      expect(stub.getCall(0).args[2].parameterStyle).to.eq(style);
    });
  });
});
