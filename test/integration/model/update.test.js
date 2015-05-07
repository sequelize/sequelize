'use strict';

/* jshint -W030 */
var Support = require(__dirname + '/../support')
  , DataTypes = require(__dirname + '/../../../lib/data-types');

describe(Support.getTestDialectTeaser('Model'), function() {
  describe('update', function () {
    it('should only update the passed fields', function () {
      var Account = this.sequelize.define('Account', {
        ownerId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          field: 'owner_id'
        },
        name: {
          type: DataTypes.STRING
        }
      });

      return Account.sync({force: true, logging: console.log}).then(function () {
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
    });
  });
});