'use strict';

const { expect } = require('chai');
const sinon = require('sinon');
const { beforeAll2, sequelize } = require('../../support');
const { DataTypes } = require('@sequelize/core');

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
});
