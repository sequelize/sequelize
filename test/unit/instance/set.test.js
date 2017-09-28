'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support   = require(__dirname + '/../support'),
  DataTypes = require(__dirname + '/../../../lib/data-types'),
  current   = Support.sequelize,
  Promise = current.Promise,
  sinon = require('sinon');

describe(Support.getTestDialectTeaser('Instance'), () => {
  describe('set', () => {
    it('sets nested keys in JSON objects', () => {
      const User = current.define('User', {
        meta: DataTypes.JSONB
      });
      const user = User.build({
        meta: {
          location: 'Stockhollm'
        }
      }, {
        isNewRecord: false,
        raw: true
      });

      const meta = user.get('meta');

      user.set('meta.location', 'Copenhagen');
      expect(user.dataValues['meta.location']).not.to.be.ok;
      expect(user.get('meta').location).to.equal('Copenhagen');
      expect(user.get('meta') === meta).to.equal(true);
      expect(user.get('meta') === meta).to.equal(true);
    });

    it('doesnt mutate the JSONB defaultValue', () => {
      const User = current.define('User', {
        meta: {
          type: DataTypes.JSONB,
          allowNull: false,
          defaultValue: {}
        }
      });
      const user1 = User.build({});
      user1.set('meta.location', 'Stockhollm');
      const user2 = User.build({});
      expect(user2.get('meta')).to.deep.equal({});
    });

    it('sets the date "1970-01-01" to previously null field', () => {
      const User = current.define('User', {
        date: {
          type: DataTypes.DATE,
          allowNull: true
        }
      });
      const user1 = User.build({
        date: null
      });
      user1.set('date', '1970-01-01');
      expect(user1.get('date')).to.be.ok;
      expect(user1.get('date').getTime()).to.equal(new Date('1970-01-01').getTime());
    });

    it('overwrites non-date originalValue with date', () => {
      const User = current.define('User', {
        date: DataTypes.DATE
      });
      const user = User.build({
        date: ' '
      }, {
        isNewRecord: false,
        raw: true
      });

      user.set('date', new Date());
      expect(user.get('date')).to.be.an.instanceof(Date);
      expect(user.get('date')).not.to.be.NaN;
    });

    describe('custom setter', () => {
      before(function() {
        this.stubCreate = sinon.stub(current.getQueryInterface(), 'insert', (instance) => {
          return Promise.resolve([ instance, 1]);
        });
      });

      after(function() {
        this.stubCreate.restore();
      });

      const User = current.define('User', {
        phoneNumber: {
          type: DataTypes.STRING,
          set (val) {
            if (typeof value === 'string') {
              val = val.replace(/^\+/, '00').replace(/\(0\)|[\s+\/.\-\(\)]/g, '');
            }
            this.setDataValue('phoneNumber', val.split(' ').reverse().join(' '));
          }
        }
      });

      it('does not set field to changed if field is set to the same value with custom setter', () => {
        const user = User.build({
          phoneNumber: 'hello world'
        });
        return user.save().then(() => {
          expect(user.changed('phoneNumber')).to.be.false;

          user.set('phoneNumber', 'hello world');
          expect(user.changed('phoneNumber')).to.be.false;
        });
      });

      it('sets field to changed if field is set to the another value with custom setter', () => {
        const user = User.build({
          phoneNumber: 'hello world'
        });
        return user.save().then(() => {
          expect(user.changed('phoneNumber')).to.be.false;

          user.set('phoneNumber', 'goodbye world');
          expect(user.changed('phoneNumber')).to.be.true;
        });
      });
    });
  });
});
