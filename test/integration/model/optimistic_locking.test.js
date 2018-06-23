'use strict';

const Support = require(__dirname + '/../support');
const DataTypes = require(__dirname + '/../../../lib/data-types');
const chai = require('chai');
const expect = chai.expect;

describe(Support.getTestDialectTeaser('Model'), () => {
  describe('optimistic locking', () => {
    let Account;
    beforeEach(function() {
      Account = this.sequelize.define('Account', {
        number: {
          type: DataTypes.INTEGER
        }
      }, {
        version: true
      });
      return Account.sync({force: true});
    });

    it('should increment the version on save', () => {
      return Account.create({number: 1}).then(account => {
        account.number += 1;
        expect(account.version).to.eq(0);
        return account.save();
      }).then(account => {
        expect(account.version).to.eq(1);
      });
    });

    it('should increment the version on update', () => {
      return Account.create({number: 1}).then(account => {
        expect(account.version).to.eq(0);
        return account.update({ number: 2 });
      }).then(account => {
        expect(account.version).to.eq(1);
        account.number += 1;
        return account.save();
      }).then(account => {
        expect(account.number).to.eq(3);
        expect(account.version).to.eq(2);
      });
    });

    it('prevents stale instances from being saved', () => {
      return expect(Account.create({number: 1}).then(accountA => {
        return Account.findById(accountA.id).then(accountB => {
          accountA.number += 1;
          return accountA.save().then(() => { return accountB; });
        });
      }).then(accountB => {
        accountB.number += 1;
        return accountB.save();
      })).to.eventually.be.rejectedWith(Support.Sequelize.OptimisticLockError);
    });

    it('increment() also increments the version', () => {
      return Account.create({number: 1}).then(account => {
        expect(account.version).to.eq(0);
        return account.increment('number', { by: 1} );
      }).then(account => {
        return account.reload();
      }).then(account => {
        expect(account.version).to.eq(1);
      });
    });

    it('decrement() also increments the version', () => {
      return Account.create({number: 1}).then(account => {
        expect(account.version).to.eq(0);
        return account.decrement('number', { by: 1} );
      }).then(account => {
        return account.reload();
      }).then(account => {
        expect(account.version).to.eq(1);
      });
    });
  });
});
