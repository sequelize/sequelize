'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require('../support'),
  DataTypes = require('sequelize/lib/data-types'),
  sinon = require('sinon');

describe(Support.getTestDialectTeaser('Model'), () => {
  before(function() {
    this.clock = sinon.useFakeTimers();
  });

  after(function() {
    this.clock.restore();
  });

  beforeEach(async function() {
    this.User = this.sequelize.define('User', {
      id: { type: DataTypes.INTEGER, primaryKey: true },
      aNumber: { type: DataTypes.INTEGER },
      bNumber: { type: DataTypes.INTEGER },
      cNumber: { type: DataTypes.INTEGER, field: 'c_number' }
    });

    await this.User.sync({ force: true });

    await this.User.bulkCreate([{
      id: 1,
      aNumber: 0,
      bNumber: 0
    }, {
      id: 2,
      aNumber: 0,
      bNumber: 0
    }, {
      id: 3,
      aNumber: 0,
      bNumber: 0
    }, {
      id: 4,
      aNumber: 0,
      bNumber: 0,
      cNumber: 0
    }]);
  });

  [
    'increment',
    'decrement'
  ].forEach(method => {
    describe(method, () => {
      before(function() {
        this.assert = (increment, decrement) => {
          return method === 'increment' ? increment : decrement;
        };
      });

      it('supports where conditions', async function() {
        await this.User.findByPk(1);
        await this.User[method](['aNumber'], { by: 2, where: { id: 1 } });
        const user3 = await this.User.findByPk(2);
        expect(user3.aNumber).to.be.equal(this.assert(0, 0));
      });

      it('uses correct column names for where conditions', async function() {
        await this.User[method](['aNumber'], { by: 2, where: { cNumber: 0 } });
        const user4 = await this.User.findByPk(4);
        expect(user4.aNumber).to.be.equal(this.assert(2, -2));
      });

      it('should still work right with other concurrent increments', async function() {
        const aUsers = await this.User.findAll();

        await Promise.all([
          this.User[method](['aNumber'], { by: 2, where: {} }),
          this.User[method](['aNumber'], { by: 2, where: {} }),
          this.User[method](['aNumber'], { by: 2, where: {} })
        ]);

        const bUsers = await this.User.findAll();
        for (let i = 0; i < bUsers.length; i++) {
          expect(bUsers[i].aNumber).to.equal(this.assert(aUsers[i].aNumber + 6, aUsers[i].aNumber - 6));
        }
      });

      it('with array', async function() {
        const aUsers = await this.User.findAll();
        await this.User[method](['aNumber'], { by: 2, where: {} });
        const bUsers = await this.User.findAll();
        for (let i = 0; i < bUsers.length; i++) {
          expect(bUsers[i].aNumber).to.equal(this.assert(aUsers[i].aNumber + 2, aUsers[i].aNumber - 2));
        }
      });

      it('with single field', async function() {
        const aUsers = await this.User.findAll();
        await this.User[method]('aNumber', { by: 2, where: {} });
        const bUsers = await this.User.findAll();
        for (let i = 0; i < bUsers.length; i++) {
          expect(bUsers[i].aNumber).to.equal(this.assert(aUsers[i].aNumber + 2, aUsers[i].aNumber - 2));
        }
      });

      it('with single field and no value', async function() {
        const aUsers = await this.User.findAll();
        await this.User[method]('aNumber', { where: {} });
        const bUsers = await this.User.findAll();
        for (let i = 0; i < bUsers.length; i++) {
          expect(bUsers[i].aNumber).to.equal(this.assert(aUsers[i].aNumber + 1, aUsers[i].aNumber - 1));
        }
      });

      it('with key value pair', async function() {
        const aUsers = await this.User.findAll();
        await this.User[method]({ 'aNumber': 1, 'bNumber': 2 }, { where: { } });
        const bUsers = await this.User.findAll();
        for (let i = 0; i < bUsers.length; i++) {
          expect(bUsers[i].aNumber).to.equal(this.assert(aUsers[i].aNumber + 1, aUsers[i].aNumber - 1));
          expect(bUsers[i].bNumber).to.equal(this.assert(aUsers[i].bNumber + 2, aUsers[i].bNumber - 2));
        }
      });

      it('should still work right with other concurrent updates', async function() {
        const aUsers = await this.User.findAll();
        await this.User.update({ 'aNumber': 2 }, { where: {} });
        await this.User[method](['aNumber'], { by: 2, where: {} });
        const bUsers = await this.User.findAll();
        for (let i = 0; i < bUsers.length; i++) {
          // for decrement 2 - 2 = 0
          expect(bUsers[i].aNumber).to.equal(this.assert(aUsers[i].aNumber + 4, aUsers[i].aNumber));
        }
      });

      it('with timestamps set to true', async function() {
        const User = this.sequelize.define('IncrementUser', {
          aNumber: DataTypes.INTEGER
        }, { timestamps: true });

        await User.sync({ force: true });
        const user = await User.create({ aNumber: 1 });
        const oldDate = user.updatedAt;

        this.clock.tick(1000);
        await User[method]('aNumber', { by: 1, where: {} });

        await expect(User.findByPk(1)).to.eventually.have.property('updatedAt').afterTime(oldDate);
      });

      it('with timestamps set to true and options.silent set to true', async function() {
        const User = this.sequelize.define('IncrementUser', {
          aNumber: DataTypes.INTEGER
        }, { timestamps: true });

        await User.sync({ force: true });
        const user = await User.create({ aNumber: 1 });
        const oldDate = user.updatedAt;
        this.clock.tick(1000);
        await User[method]('aNumber', { by: 1, silent: true, where: { } });

        await expect(User.findByPk(1)).to.eventually.have.property('updatedAt').equalTime(oldDate);
      });

      it('should work with scopes', async function() {
        const User = this.sequelize.define('User', {
          aNumber: DataTypes.INTEGER,
          name: DataTypes.STRING
        }, {
          scopes: {
            jeff: {
              where: {
                name: 'Jeff'
              }
            }
          }
        });

        await User.sync({ force: true });

        await User.bulkCreate([
          {
            aNumber: 1,
            name: 'Jeff'
          },
          {
            aNumber: 3,
            name: 'Not Jeff'
          }
        ]);

        await User.scope('jeff')[method]('aNumber', {});
        const jeff = await User.scope('jeff').findOne();
        expect(jeff.aNumber).to.equal(this.assert(2, 0));

        const notJeff = await User.findOne({
          where: {
            name: 'Not Jeff'
          }
        });

        expect(notJeff.aNumber).to.equal(this.assert(3, 3));
      });

      it('should not care for attributes in the instance scope', async function() {
        this.User.addScope('test', {
          attributes: ['foo', 'bar']
        });
        const createdUser = await this.User.scope('test').create({ id: 5, aNumber: 5 });
        await createdUser[method]('aNumber', { by: 2 });
        const user = await this.User.findByPk(5);
        expect(user.aNumber).to.equal(this.assert(7, 3));
      });
      it('should not care for exclude-attributes in the instance scope', async function() {
        this.User.addScope('test', {
          attributes: { exclude: ['foo', 'bar'] }
        });
        const createdUser = await this.User.scope('test').create({ id: 5, aNumber: 5 });
        await createdUser[method]('aNumber', { by: 2 });
        const user = await this.User.findByPk(5);
        expect(user.aNumber).to.equal(this.assert(7, 3));
      });
      it('should not care for include-attributes in the instance scope', async function() {
        this.User.addScope('test', {
          attributes: { include: ['foo', 'bar'] }
        });
        const createdUser = await this.User.scope('test').create({ id: 5, aNumber: 5 });
        await createdUser[method]('aNumber', { by: 2 });
        const user = await this.User.findByPk(5);
        expect(user.aNumber).to.equal(this.assert(7, 3));
      });

    });
  });
});
