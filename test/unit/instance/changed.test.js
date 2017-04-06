'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support   = require(__dirname + '/../support'),
  DataTypes = require(__dirname + '/../../../lib/data-types'),
  current   = Support.sequelize;

describe(Support.getTestDialectTeaser('Instance'), () => {
  describe('changed', () => {
    beforeEach(function() {
      this.User = current.define('User', {
        name: DataTypes.STRING,
        birthdate: DataTypes.DATE,
        meta: DataTypes.JSON
      });
    });

    it('should return true for changed primitive', function() {
      const user = this.User.build({
        name: 'a'
      }, {
        isNewRecord: false,
        raw: true
      });

      expect(user.changed('meta')).to.equal(false);
      user.set('name', 'b');
      user.set('meta', null);
      expect(user.changed('name')).to.equal(true);
      expect(user.changed('meta')).to.equal(true);
    });

    it('should return falsy for unchanged primitive', function() {
      const user = this.User.build({
        name: 'a',
        meta: null
      }, {
        isNewRecord: false,
        raw: true
      });

      user.set('name', 'a');
      user.set('meta', null);
      expect(user.changed('name')).to.equal(false);
      expect(user.changed('meta')).to.equal(false);
    });

    it('should return true for multiple changed values', function() {
      const user = this.User.build({
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

    it('should return false for two instances with same value', function() {
      const milliseconds = 1436921941088;
      const firstDate = new Date(milliseconds);
      const secondDate = new Date(milliseconds);

      const user = this.User.build({
        birthdate: firstDate
      }, {
        isNewRecord: false,
        raw: true
      });

      user.set('birthdate', secondDate);
      expect(user.changed('birthdate')).to.equal(false);
    });

    it('should return true for changed JSON with same object', function() {
      const user = this.User.build({
        meta: {
          city: 'Copenhagen'
        }
      }, {
        isNewRecord: false,
        raw: true
      });

      const meta = user.get('meta');
      meta.city = 'Stockholm';

      user.set('meta', meta);
      expect(user.changed('meta')).to.equal(true);
    });

    it('should return true for JSON dot.separated key with changed values', function() {
      const user = this.User.build({
        meta: {
          city: 'Stockholm'
        }
      }, {
        isNewRecord: false,
        raw: true
      });

      user.set('meta.city', 'Gothenburg');
      expect(user.changed('meta')).to.equal(true);
    });

    it('should return false for JSON dot.separated key with same value', function() {
      const user = this.User.build({
        meta: {
          city: 'Gothenburg'
        }
      }, {
        isNewRecord: false,
        raw: true
      });

      user.set('meta.city', 'Gothenburg');
      expect(user.changed('meta')).to.equal(false);
    });

    it('should return true for JSON dot.separated key with object', function() {
      const user = this.User.build({
        meta: {
          address: { street: 'Main street', number: '40' }
        }
      }, {
        isNewRecord: false,
        raw: true
      });

      user.set('meta.address', { street: 'Second street', number: '1' } );
      expect(user.changed('meta')).to.equal(true);
    });

    it('should return false for JSON dot.separated key with same object', function() {
      const user = this.User.build({
        meta: {
          address: { street: 'Main street', number: '40' }
        }
      }, {
        isNewRecord: false,
        raw: true
      });

      user.set('meta.address', { street: 'Main street', number: '40' } );
      expect(user.changed('meta')).to.equal(false);
    });
  });
});
