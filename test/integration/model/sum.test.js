'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require('../support'),
  DataTypes = require('sequelize/lib/data-types');

describe(Support.getTestDialectTeaser('Model'), () => {
  beforeEach(async function() {
    this.Payment = this.sequelize.define('Payment', {
      amount: DataTypes.DECIMAL,
      mood: {
        type: DataTypes.ENUM,
        values: ['happy', 'sad', 'neutral']
      }
    });

    await this.sequelize.sync({ force: true });

    await this.Payment.bulkCreate([
      { amount: 5, mood: 'neutral' },
      { amount: -5, mood: 'neutral' },
      { amount: 10, mood: 'happy' },
      { amount: 90, mood: 'happy' }
    ]);
  });

  describe('sum', () => {

    it('should sum without rows', async function() {
      await expect(this.Payment.sum('amount', { where: { mood: 'sad' } })).to.eventually.be.null;
    });

    it('should sum when is 0', async function() {
      await expect(this.Payment.sum('amount', { where: { mood: 'neutral' } })).to.eventually.be.equal(0);
    });

    it('should sum', async function() {
      await expect(this.Payment.sum('amount', { where: { mood: 'happy' } })).to.eventually.be.equal(100);
    });
  });
});
