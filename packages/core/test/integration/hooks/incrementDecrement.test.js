'use strict';

const chai = require('chai');

const expect = chai.expect;
const Support = require('../support');
const { DataTypes } = require('@sequelize/core');

describe(Support.getTestDialectTeaser('Hooks'), () => {
  beforeEach(async function () {
    this.User = this.sequelize.define('User', {
      username: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      integer: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
    });
    await this.sequelize.sync({ force: true });
  });

  describe('#incrementdecrement', () => {
    beforeEach(async function () {
      await this.User.bulkCreate([
        { username: 'adam', integer: 1 },
      ]);
    });

    describe('on success', () => {
      it('hook runs', async () => {
        let beforeHook = false;

        this.User.beforeIncrementDecrement(() => {
          beforeHook = true;
        });

        const user = await this.User.findOne({ where: { username: 'adam' } });
        await user.increment('integer');
        expect(beforeHook).to.be.true;
      });
    });

    describe('on error', () => {
      it('in beforeIncrement hook returns error', async () => {
        this.User.beforeIncrementDecrement(() => {
          throw new Error('Oops!');
        });

        await expect(this.User.increment('integer', { where: { username: 'adam' } })).to.be.rejectedWith('Oops!');
      });
    });
  });

});
