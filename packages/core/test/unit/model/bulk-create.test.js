'use strict';

const chai = require('chai');

const expect = chai.expect;
const sinon = require('sinon');
const Support = require('../../support');
const { DataTypes } = require('@sequelize/core');

const current = Support.sequelize;

describe(Support.getTestDialectTeaser('Model'), () => {
  describe('bulkCreate', () => {
    const Model = current.define(
      'model',
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

    let stub;

    before(() => {
      stub = sinon.stub(current.queryInterface, 'bulkInsert').resolves([]);
    });

    afterEach(() => {
      stub.resetHistory();
    });

    after(() => {
      stub.restore();
    });

    describe('validations', () => {
      it('should not fail for renamed fields', async () => {
        await Model.bulkCreate([{ accountId: 42, purchaseCount: 4 }], {
          validate: true,
        });

        expect(stub.getCall(0).args[1]).to.deep.equal([
          { account_id: 42, purchaseCount: 4, id: null },
        ]);
      });

      if (current.dialect.supports.inserts.updateOnDuplicate) {
        it('should map conflictAttributes to column names', async () => {
          // Note that the model also has an id key as its primary key.
          await Model.bulkCreate([{ accountId: 42, purchaseCount: 3 }], {
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
});
