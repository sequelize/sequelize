'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require('../support'),
  DataTypes = require('sequelize/lib/data-types');

describe(Support.getTestDialectTeaser('Hooks'), () => {
  beforeEach(async function() {
    this.User = this.sequelize.define('User', {
      username: {
        type: DataTypes.STRING,
        allowNull: false
      },
      mood: {
        type: DataTypes.ENUM,
        values: ['happy', 'sad', 'neutral']
      }
    });
    await this.sequelize.sync({ force: true });
  });

  describe('#count', () => {
    beforeEach(async function() {
      await this.User.bulkCreate([
        { username: 'adam', mood: 'happy' },
        { username: 'joe', mood: 'sad' },
        { username: 'joe', mood: 'happy' }
      ]);
    });

    describe('on success', () => {
      it('hook runs', async function() {
        let beforeHook = false;

        this.User.beforeCount(() => {
          beforeHook = true;
        });

        const count = await this.User.count();
        expect(count).to.equal(3);
        expect(beforeHook).to.be.true;
      });

      it('beforeCount hook can change options', async function() {
        this.User.beforeCount(options => {
          options.where.username = 'adam';
        });

        await expect(this.User.count({ where: { username: 'joe' } })).to.eventually.equal(1);
      });
    });

    describe('on error', () => {
      it('in beforeCount hook returns error', async function() {
        this.User.beforeCount(() => {
          throw new Error('Oops!');
        });

        await expect(this.User.count({ where: { username: 'adam' } })).to.be.rejectedWith('Oops!');
      });
    });
  });

});
