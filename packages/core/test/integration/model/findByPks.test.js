'use strict';

const { expect } = require('chai');
const Support = require('../support');
const { DataTypes } = require('@sequelize/core');

describe(Support.getTestDialectTeaser('Model'), () => {
  describe('findByPks', () => {
    beforeEach(async function () {
      this.User = this.sequelize.define('User', {
        username: DataTypes.STRING,
      });

      await this.User.sync({ force: true });
    });

    it('should find multiple records by primary key', async function () {
      const users = await this.User.bulkCreate([
        { username: 'alice' },
        { username: 'bob' },
        { username: 'charlie' },
      ]);

      const found = await this.User.findByPks([users[0].id, users[2].id]);

      expect(found).to.have.length(2);
      const names = found.map(u => u.username).sort();
      expect(names).to.deep.equal(['alice', 'charlie']);
    });

    it('should return empty array when no ids match', async function () {
      await this.User.create({ username: 'alice' });

      const users = await this.User.findByPks([99_999, 99_998]);
      expect(users).to.deep.equal([]);
    });

    it('should return empty array for empty input', async function () {
      const users = await this.User.findByPks([]);
      expect(users).to.deep.equal([]);
    });

    it('should work with composite primary keys', async function () {
      const OrderItem = this.sequelize.define('OrderItem', {
        orderId: {
          type: DataTypes.INTEGER,
          primaryKey: true,
        },
        itemId: {
          type: DataTypes.INTEGER,
          primaryKey: true,
        },
        quantity: DataTypes.INTEGER,
      });

      await OrderItem.sync({ force: true });

      await OrderItem.bulkCreate([
        { orderId: 1, itemId: 10, quantity: 2 },
        { orderId: 1, itemId: 20, quantity: 5 },
        { orderId: 2, itemId: 10, quantity: 1 },
      ]);

      const results = await OrderItem.findByPks([
        { orderId: 1, itemId: 10 },
        { orderId: 2, itemId: 10 },
      ]);

      expect(results).to.have.length(2);
      const quantities = results.map(r => r.quantity).sort();
      expect(quantities).to.deep.equal([1, 2]);
    });

    it('should respect additional where conditions', async function () {
      const Item = this.sequelize.define('Item', {
        name: DataTypes.STRING,
        active: DataTypes.BOOLEAN,
      });

      await Item.sync({ force: true });

      const [a, b] = await Promise.all([
        Item.create({ name: 'one', active: true }),
        Item.create({ name: 'two', active: false }),
      ]);

      const results = await Item.findByPks([a.id, b.id], {
        where: { active: true },
      });

      expect(results).to.have.length(1);
      expect(results[0].name).to.equal('one');
    });
  });
});
