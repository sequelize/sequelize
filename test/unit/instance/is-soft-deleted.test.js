'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support   = require('../support'),
  current   = Support.sequelize,
  DataTypes = require('sequelize/lib/data-types'),
  Sequelize = Support.Sequelize,
  moment    = require('moment');

describe(Support.getTestDialectTeaser('Instance'), () => {
  describe('isSoftDeleted', () => {
    beforeEach(function() {
      const User = current.define('User', {
        name: DataTypes.STRING,
        birthdate: DataTypes.DATE,
        meta: DataTypes.JSON,
        deletedAt: {
          type: Sequelize.DATE
        }
      });

      const ParanoidUser = current.define('User', {
        name: DataTypes.STRING,
        birthdate: DataTypes.DATE,
        meta: DataTypes.JSON,
        deletedAt: {
          type: Sequelize.DATE
        }
      }, {
        paranoid: true
      });

      this.paranoidUser = ParanoidUser.build({
        name: 'a'
      }, {
        isNewRecord: false,
        raw: true
      });

      this.user = User.build({
        name: 'a'
      }, {
        isNewRecord: false,
        raw: true
      });
    });

    it('should not throw if paranoid is set to true', function() {
      expect(() => {
        this.paranoidUser.isSoftDeleted();
      }).to.not.throw();
    });

    it('should throw if paranoid is set to false', function() {
      expect(() => {
        this.user.isSoftDeleted();
      }).to.throw('Model is not paranoid');
    });

    it('should return false if the soft-delete property is the same as the default value', function() {
      this.paranoidUser.setDataValue('deletedAt', null);
      expect(this.paranoidUser.isSoftDeleted()).to.be.false;
    });

    it('should return true if the soft-delete property is set', function() {
      this.paranoidUser.setDataValue('deletedAt', moment().subtract(5, 'days').format());
      expect(this.paranoidUser.isSoftDeleted()).to.be.true;
    });
  });
});
