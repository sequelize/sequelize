'use strict';

/* jshint -W030 */
var Support = require(__dirname + '/../support')
  , DataTypes = require(__dirname + '/../../../lib/data-types')
  , chai = require('chai')
  , expect = chai.expect
  , Support = require(__dirname + '/../support')
  , current = Support.sequelize
  , _ = require('lodash');

describe(Support.getTestDialectTeaser('Model'), function() {
  describe('update', function () {

    var Account;

    beforeEach(function() {
      Account = this.sequelize.define('Account', {
        ownerId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          field: 'owner_id'
        },
        name: {
          type: DataTypes.STRING
        }
      });
      return Account.sync({force: true});
    });

    it('should only update the passed fields', function () {
      return Account.create({
        ownerId: 2
      }).then(function (account) {
        return Account.update({
          name: Math.random().toString()
        }, {
          where: {
            id: account.get('id')
          }
        });
      });
    });
      
    it('should not check for notNull Violation for undefined values', function () {
      var ownerId = 2
        , accountRowId;
      return Account.create({
        ownerId: ownerId,
        name: Math.random().toString()
      }).then(function (account) {
        accountRowId = account.get('id');
        var accountVal = {
          name: Math.random().toString(),
          ownerId: undefined
        };
        return Account.update(accountVal, {
          where: {
            id: accountRowId
          }
        });
      }).then(function(rows) {
        return Account.findById(accountRowId);
      }).then(function(account) {
        expect(account.ownerId).to.be.equal(ownerId);  
      });
    });      


    if (_.get(current.dialect.supports, 'returnValues.returning')) {
      it('should return the updated record', function () {
        return Account.create({
          ownerId: 2
        }).then(function (account) {
          return Account.update({
            name: 'FooBar'
          }, {
            where: {
              id: account.get('id')
            },
            returning: true
          }).spread(function(count, accounts) {
            var account = accounts[0];
            expect(account.ownerId).to.be.equal(2);
            expect(account.name).to.be.equal('FooBar');
          });
        });
      });
    }

  });
});
