'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support   = require(__dirname + '/../support'),
  current   = Support.sequelize,
  DataTypes = require(__dirname + '/../../../lib/data-types'),
  Sequelize = Support.Sequelize;

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
  });
});
