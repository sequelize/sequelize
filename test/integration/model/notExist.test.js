'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require('../support'),
  DataTypes = require('sequelize/lib/data-types');

describe(Support.getTestDialectTeaser('Model'), () => {
  beforeEach(async function() {
    this.Order = this.sequelize.define('Order', {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      sequence: DataTypes.INTEGER,
      amount: DataTypes.DECIMAL,
      type: DataTypes.STRING
    });

    await this.sequelize.sync({ force: true });

    await this.Order.bulkCreate([
      { sequence: 1, amount: 3, type: 'A' },
      { sequence: 2, amount: 4, type: 'A' },
      { sequence: 3, amount: 5, type: 'A' },
      { sequence: 4, amount: 1, type: 'A' },
      { sequence: 1, amount: 2, type: 'B' },
      { sequence: 2, amount: 6, type: 'B' },
      { sequence: 0, amount: 0, type: 'C' }
    ]);
  });

  describe('max', () => {
    it('type A to C should exist', async function() {
      await expect(this.Order.sum('sequence', { where: { type: 'A' } })).to.eventually.be.equal(10);
      await expect(this.Order.max('sequence', { where: { type: 'A' } })).to.eventually.be.equal(4);
      await expect(this.Order.min('sequence', { where: { type: 'A' } })).to.eventually.be.equal(1);
      await expect(this.Order.sum('amount', { where: { type: 'A' } })).to.eventually.be.equal(13);
      await expect(this.Order.max('amount', { where: { type: 'A' } })).to.eventually.be.equal(5);
      await expect(this.Order.min('amount', { where: { type: 'A' } })).to.eventually.be.equal(1);

      await expect(this.Order.sum('sequence', { where: { type: 'B' } })).to.eventually.be.equal(3);
      await expect(this.Order.max('sequence', { where: { type: 'B' } })).to.eventually.be.equal(2);
      await expect(this.Order.min('sequence', { where: { type: 'B' } })).to.eventually.be.equal(1);
      await expect(this.Order.sum('amount', { where: { type: 'B' } })).to.eventually.be.equal(8);
      await expect(this.Order.max('amount', { where: { type: 'B' } })).to.eventually.be.equal(6);
      await expect(this.Order.min('amount', { where: { type: 'B' } })).to.eventually.be.equal(2);

      await expect(this.Order.sum('sequence', { where: { type: 'C' } })).to.eventually.be.equal(0);
      await expect(this.Order.max('sequence', { where: { type: 'C' } })).to.eventually.be.equal(0);
      await expect(this.Order.min('sequence', { where: { type: 'C' } })).to.eventually.be.equal(0);
      await expect(this.Order.sum('amount', { where: { type: 'C' } })).to.eventually.be.equal(0);
      await expect(this.Order.max('amount', { where: { type: 'C' } })).to.eventually.be.equal(0);
      await expect(this.Order.min('amount', { where: { type: 'C' } })).to.eventually.be.equal(0);
    });

    it('type D should not exist', async function() {
      await expect(this.Order.sum('sequence', { where: { type: 'D' } })).to.eventually.be.null;
      await expect(this.Order.max('sequence', { where: { type: 'D' } })).to.eventually.be.null;
      await expect(this.Order.min('sequence', { where: { type: 'D' } })).to.eventually.be.null;
      await expect(this.Order.sum('amount', { where: { type: 'D' } })).to.eventually.be.null;
      await expect(this.Order.max('amount', { where: { type: 'D' } })).to.eventually.be.null;
      await expect(this.Order.min('amount', { where: { type: 'D' } })).to.eventually.be.null;
    });
  });
});
