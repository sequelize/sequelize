'use strict';

/* jshint -W030 */
var Support = require(__dirname + '/../support');
var DataTypes = require(__dirname + '/../../../lib/data-types');
var chai = require('chai');
var expect = chai.expect;
var sinon = require('sinon');
var Support = require(__dirname + '/../support');

describe(Support.getTestDialectTeaser('Model'), function () {
  describe('paranoid', function () {
    before(function () {
      this.clock = sinon.useFakeTimers();
    });

    after(function () {
      this.clock.restore();
    });

    it('should be able to soft delete with timestamps', function () {
      var Account = this.sequelize.define('Account', {
        ownerId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          field: 'owner_id'
        },
        name: {
          type: DataTypes.STRING
        }
      }, {
        paranoid: true,
        timestamps: true
      });

      return Account.sync({force: true})
        .then(function () { return Account.create({ ownerId: 12 }); })
        .then(function () { return Account.count(); })
        .then(function (count) {
          expect(count).to.be.equal(1);
          return Account.destroy({ where: { ownerId: 12 }})
          .then(function (result) {
            expect(result).to.be.equal(1);
          });
        })
        .then(function () { return Account.count(); })
        .then(function (count) {
          expect(count).to.be.equal(0);
          return Account.count({ paranoid: false });
        })
        .then(function (count) {
          expect(count).to.be.equal(1);
          return Account.restore({ where: { ownerId: 12 }});
        })
        .then(function () { return Account.count(); })
        .then(function (count) {
          expect(count).to.be.equal(1);
        });
    });

    it('should be able to soft delete without timestamps', function () {
      var Account = this.sequelize.define('Account', {
        ownerId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          field: 'owner_id'
        },
        name: {
          type: DataTypes.STRING
        },
        deletedAt: {
          type: DataTypes.DATE,
          allowNull: true,
          field: 'deleted_at'
        }
      }, {
        paranoid: true,
        timestamps: true,
        deletedAt: 'deletedAt',
        createdAt: false,
        updatedAt: false
      });

      return Account.sync({force: true})
        .then(function () { return Account.create({ ownerId: 12 }); })
        .then(function () { return Account.count(); })
        .then(function (count) {
          expect(count).to.be.equal(1);
          return Account.destroy({ where: { ownerId: 12 }});
        })
        .then(function () { return Account.count(); })
        .then(function (count) {
          expect(count).to.be.equal(0);
          return Account.count({ paranoid: false });
        })
        .then(function (count) {
          expect(count).to.be.equal(1);
          return Account.restore({ where: { ownerId: 12 }});
        })
        .then(function () { return Account.count(); })
        .then(function (count) {
          expect(count).to.be.equal(1);
        });
    });
  });
});
