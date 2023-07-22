'use strict';

const chai = require('chai');

const expect = chai.expect;
const Support = require('../support');
const { DataTypes } = require('@sequelize/core');

describe(Support.getTestDialectTeaser('Hooks'), () => {
  beforeEach(async () => {
    this.Product = this.sequelize.define('Product', {
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      stockCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
    });
    await this.sequelize.sync({ force: true });
  });

  describe('#incrementdecrement', () => {
    beforeEach(async () => {
      await this.Product.bulkCreate([
        { name: 'product1', count: 1 },
      ]);
    });

    describe('on success', () => {
      it('hook runs', async () => {
        let beforeHook = false;

        this.Product.beforeIncrementDecrement(() => {
          beforeHook = true;
        });

        const product = await this.Product.findOne({ where: { name: 'product1' } });
        await product.increment('stockCount');
        expect(product.stockCount).to.equal(2);
        expect(beforeHook).to.be.true;
      });
    });

    describe('on error', () => {
      it('in beforeIncrement hook returns error', async () => {
        this.Product.beforeIncrement(() => {
          throw new Error('Oops!');
        });

        const product = await this.Product.findOne({ where: { name: 'product1' } });
        await expect(product.increment('stockCount')).to.be.rejectedWith('Oops!');
      });
    });
  });

});
