'use strict';

/* jshint -W030 */
var chai = require('chai')
  , expect = chai.expect
  , Support   = require(__dirname + '/../support')
  , DataTypes = require(__dirname + '/../../../lib/data-types')
  , current   = Support.sequelize;

describe(Support.getTestDialectTeaser('Instance'), function() {
  describe('changed', function () {
    beforeEach(function () {
      this.User = current.define('User', {
        name: DataTypes.STRING,
        birthdate: DataTypes.DATE,
        meta: DataTypes.JSON
      });
    });

    it('should return true for changed primitive', function () {
      var user = this.User.build({
        name: 'a'
      }, {
        isNewRecord: false,
        raw: true
      });

      user.set('name', 'b');
      expect(user.changed('name')).to.equal(true);
    });

    it('should return falsy for unchanged primitive', function () {
      var user = this.User.build({
        name: 'a'
      }, {
        isNewRecord: false,
        raw: true
      });

      user.set('name', 'a');
      expect(user.changed('name')).to.equal(false);
    });

    it('should return true for multiple changed values', function () {
      var user = this.User.build({
        name: 'a',
        birthdate: new Date(new Date() - 10)
      }, {
        isNewRecord: false,
        raw: true
      });

      user.set('name', 'b');
      user.set('birthdate', new Date());
      expect(user.changed('name')).to.equal(true);
      expect(user.changed('birthdate')).to.equal(true);
    });

    it('should return true for changed JSON with same object', function () {
      var user = this.User.build({
        meta: {
          city: 'Copenhagen'
        }
      }, {
        isNewRecord: false,
        raw: true
      });

      var meta = user.get('meta');
      meta.city = 'Stockholm';

      user.set('meta', meta);
      expect(user.changed('meta')).to.equal(true);
    });
  });
});