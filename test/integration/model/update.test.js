'use strict';

const Support = require('../support');
const DataTypes = require('sequelize/lib/data-types');
const chai = require('chai');
const sinon = require('sinon');
const expect = chai.expect;
const current = Support.sequelize;
const _ = require('lodash');

describe(Support.getTestDialectTeaser('Model'), () => {
  describe('update', () => {
    beforeEach(async function() {
      this.Account = this.sequelize.define('Account', {
        ownerId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          field: 'owner_id'
        },
        name: {
          type: DataTypes.STRING
        }
      });
      await this.Account.sync({ force: true });
    });

    it('should only update the passed fields', async function() {
      const account = await this.Account
        .create({ ownerId: 2 });

      await this.Account.update({
        name: Math.random().toString()
      }, {
        where: {
          id: account.get('id')
        }
      });
    });

    describe('skips update query', () => {
      it('if no data to update', async function() {
        const spy = sinon.spy();

        await this.Account.create({ ownerId: 3 });

        const result = await this.Account.update({
          unknownField: 'haha'
        }, {
          where: {
            ownerId: 3
          },
          logging: spy
        });

        expect(result[0]).to.equal(0);
        expect(spy.called, 'Update query was issued when no data to update').to.be.false;
      });

      it('skips when timestamps disabled', async function() {
        const Model = this.sequelize.define('Model', {
          ownerId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            field: 'owner_id'
          },
          name: {
            type: DataTypes.STRING
          }
        }, {
          timestamps: false
        });
        const spy = sinon.spy();

        await Model.sync({ force: true });
        await Model.create({ ownerId: 3 });

        const result = await Model.update({
          unknownField: 'haha'
        }, {
          where: {
            ownerId: 3
          },
          logging: spy
        });

        expect(result[0]).to.equal(0);
        expect(spy.called, 'Update query was issued when no data to update').to.be.false;
      });
    });

    it('changed should be false after reload', async function() {
      const account0 = await this.Account.create({ ownerId: 2, name: 'foo' });
      account0.name = 'bar';
      expect(account0.changed()[0]).to.equal('name');
      const account = await account0.reload();
      expect(account.changed()).to.equal(false);
    });

    it('should ignore undefined values without throwing not null validation', async function() {
      const ownerId = 2;

      const account0 = await this.Account.create({
        ownerId,
        name: Math.random().toString()
      });

      await this.Account.update({
        name: Math.random().toString(),
        ownerId: undefined
      }, {
        where: {
          id: account0.get('id')
        }
      });

      const account = await this.Account.findOne();
      expect(account.ownerId).to.be.equal(ownerId);
    });

    if (_.get(current.dialect.supports, 'returnValues.returning')) {
      it('should return the updated record', async function() {
        const account = await this.Account.create({ ownerId: 2 });

        const [, accounts] = await this.Account.update({ name: 'FooBar' }, {
          where: {
            id: account.get('id')
          },
          returning: true
        });

        const firstAcc = accounts[0];
        expect(firstAcc.ownerId).to.be.equal(2);
        expect(firstAcc.name).to.be.equal('FooBar');
      });
    }

    if (_.get(current.dialect.supports, 'returnValues.output')) {
      it('should output the updated record', async function() {
        const account = await this.Account.create({ ownerId: 2 });

        const [, accounts] = await this.Account.update({ name: 'FooBar' }, {
          where: {
            id: account.get('id')
          },
          returning: true
        });

        const firstAcc = accounts[0];
        expect(firstAcc.name).to.be.equal('FooBar');

        await firstAcc.reload();
        expect(firstAcc.ownerId, 'Reloaded as output update only return primary key and changed fields').to.be.equal(2);
      });
    }

    if (current.dialect.supports['LIMIT ON UPDATE']) {
      it('should only update one row', async function() {
        await this.Account.create({
          ownerId: 2,
          name: 'Account Name 1'
        });

        await this.Account.create({
          ownerId: 2,
          name: 'Account Name 2'
        });

        await this.Account.create({
          ownerId: 2,
          name: 'Account Name 3'
        });

        const options = {
          where: {
            ownerId: 2
          },
          limit: 1
        };
        const account = await this.Account.update({ name: 'New Name' }, options);
        expect(account[0]).to.equal(1);
      });
    }
  });
});
