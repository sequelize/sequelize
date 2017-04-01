'use strict';

/* jshint -W030 */
var chai = require('chai')
  , expect = chai.expect
  , Support   = require(__dirname + '/../support')
  , DataTypes = require(__dirname + '/../../../lib/data-types')
  , current   = Support.sequelize;

describe(Support.getTestDialectTeaser('Instance'), function() {
  describe('set', function () {
    it('sets nested keys in JSON objects', function () {
      var User = current.define('User', {
        meta: DataTypes.JSONB
      });
      var user = User.build({
        meta: {
          location: 'Stockhollm'
        }
      }, {
        isNewRecord: false,
        raw: true
      });

      var meta = user.get('meta');

      user.set('meta.location', 'Copenhagen');
      expect(user.dataValues['meta.location']).not.to.be.ok;
      expect(user.get('meta').location).to.equal('Copenhagen');
      expect(user.get('meta') === meta).to.equal(true);
      expect(user.get('meta') === meta).to.equal(true);
    });

    it('doesnt mutate the JSONB defaultValue', function() {
      var User = current.define('User', {
        meta: {
          type: DataTypes.JSONB,
          allowNull: false,
          defaultValue: {}
        }
      });
      var user1 = User.build({});
      user1.set('meta.location', 'Stockhollm');
      var user2 = User.build({});
      expect(user2.get('meta')).to.deep.equal({});
    });

    it('sets the date "1970-01-01" to previously null field', function() {
      var User = current.define('User', {
        date: {
          type: DataTypes.DATE,
          allowNull: true
        }
      });
      var user1 = User.build({
        date: null
      });
      user1.set('date', '1970-01-01');
      expect(user1.get('date')).to.be.ok;
      expect(user1.get('date').getTime()).to.equal(new Date('1970-01-01').getTime());
    });

    it('overwrites non-date originalValue with date', function() {
      var User = current.define('User', {
        date: DataTypes.DATE
      });
      var user = User.build({
        date: ' '
      }, {
        isNewRecord: false,
        raw: true
      });

      user.set('date', new Date());
      expect(user.get('date')).to.be.an.instanceof(Date);
      expect(user.get('date')).not.to.be.NaN;
    });
  });
});
