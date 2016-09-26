'use strict';

const Support = require(__dirname + '/../support')
  , DataTypes = require(__dirname + '/../../../lib/data-types')
  , chai = require('chai')
  , expect = chai.expect
  , _ = require('lodash');

describe(Support.getTestDialectTeaser('Model'), function() {
  describe('optimistic locking', function () {
    var Account;
    beforeEach(function() {
      Account = this.sequelize.define('Account', {
        number: {
          type: DataTypes.INTEGER,
        }
      }, {
        version: true
      });
      return Account.sync({force: true});
    });

    it('should increment the version on update', function() {
      return Account.create({number: 1}).then(function(account) {
        account.number += 1;
        expect(account.version).to.eq(0);
        return account.save();
      }).then(function(account) {
        expect(account.version).to.eq(1);
      });
    });

    it('prevents stale instances from being saved', function() {
      return Account.create({number: 1}).then(function(accountA) {
        return Account.findById(accountA.id).then(function(accountB) {
          accountA.number += 1;
          return accountA.save().then(function() { return accountB; });
        });
      }).then(function(accountB) {
        accountB.number += 1;
        return accountB.save();
      }).then(function() {
        expect.fail('Expect save() to throw OptimisticLockError');
      }).catch(function(error) {
        expect(error.name).to.eq('OptimisticLockError');
      });
    });

    it('increment() also increments the version', function() {
      return Account.create({number: 1}).then(function(account) {
        expect(account.version).to.eq(0);
        return account.increment('number', { by: 1} );
      }).then(function(account) {
        return account.reload();
      }).then(function(account) {
        expect(account.version).to.eq(1);
      });
    });
  });
});
