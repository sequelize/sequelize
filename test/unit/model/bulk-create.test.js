'use strict';

const chai = require('chai'),
  expect = chai.expect,
  sinon = require('sinon'),
  Support = require('../support'),
  DataTypes = require('sequelize/lib/data-types'),
  current = Support.sequelize;

describe(Support.getTestDialectTeaser('Model'), () => {
  describe('bulkCreate', () => {
    before(function() {
      this.Model = current.define('model', {
        accountId: {
          type: DataTypes.INTEGER(11).UNSIGNED,
          allowNull: false,
          field: 'account_id'
        },
        purchaseCount: {
          type: DataTypes.INTEGER(11).UNSIGNED,
          allowNull: false,
          underscored: true
        }
      }, { timestamps: false });

      this.stub = sinon.stub(current.getQueryInterface(), 'bulkInsert').resolves([]);
    });

    afterEach(function() {
      this.stub.resetHistory();
    });

    after(function() {
      this.stub.restore();
    });

    describe('validations', () => {
      it('should not fail for renamed fields', async function() {
        await this.Model.bulkCreate([
          { accountId: 42, purchaseCount: 4 }
        ], { validate: true });

        expect(this.stub.getCall(0).args[1]).to.deep.equal([
          { account_id: 42, purchaseCount: 4, id: null }
        ]);
      });

      if (current.dialect.supports.inserts.updateOnDuplicate) {
        it('should map conflictAttributes to column names', async function() {
          // Note that the model also has an id key as its primary key.
          await this.Model.bulkCreate([{ accountId: 42, purchaseCount: 3 }], {
            conflictAttributes: ['accountId'],
            updateOnDuplicate: ['purchaseCount']
          });

          expect(
            // Not worth checking that the reference of the array matches - just the contents.
            this.stub.getCall(0).args[2].upsertKeys
          ).to.deep.equal(['account_id']);
        });
      }
    });
  });
});
