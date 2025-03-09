'use strict';

const { expect } = require('chai');
const { beforeAll2, sequelize } = require('../../support');
const { DataTypes } = require('@sequelize/core');
const sinon = require('sinon');

const dialect = sequelize.dialect;

describe('Model#set', () => {
  if (dialect.supports.dataTypes.JSONB) {
    it('sets nested keys in JSON objects', () => {
      const User = sequelize.define('User', {
        meta: DataTypes.JSONB,
      });
      const user = User.build(
        {
          meta: {
            location: 'Stockhollm',
          },
        },
        {
          isNewRecord: false,
          raw: true,
        },
      );

      const meta = user.get('meta');

      user.set('meta.location', 'Copenhagen');
      expect(user.dataValues['meta.location']).not.to.be.ok;
      expect(user.get('meta').location).to.equal('Copenhagen');
      expect(user.get('meta') === meta).to.equal(true);
      expect(user.get('meta') === meta).to.equal(true);
    });

    it('doesnt mutate the JSONB defaultValue', () => {
      const User = sequelize.define('User', {
        meta: {
          type: DataTypes.JSONB,
          allowNull: false,
          defaultValue: {},
        },
      });
      const user1 = User.build({});
      user1.set('meta.location', 'Stockhollm');
      const user2 = User.build({});
      expect(user2.get('meta')).to.deep.equal({});
    });
  }

  it('sets the date "1970-01-01" to previously null field', () => {
    const User = sequelize.define('User', {
      date: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    });
    const user1 = User.build({
      date: null,
    });
    user1.set('date', '1970-01-01');
    expect(user1.get('date')).to.be.ok;
    expect(user1.get('date').getTime()).to.equal(new Date('1970-01-01').getTime());
  });

  it('overwrites non-date originalValue with date', () => {
    const User = sequelize.define('User', {
      date: DataTypes.DATE,
    });
    const user = User.build(
      {
        date: ' ',
      },
      {
        isNewRecord: false,
        raw: true,
      },
    );

    user.set('date', new Date());
    expect(user.get('date')).to.be.an.instanceof(Date);
    expect(user.get('date')).not.to.be.NaN;
  });

  describe('custom setter', () => {
    const vars = beforeAll2(() => {
      const stubCreate = sinon
        .stub(sequelize.queryInterface, 'insert')
        .callsFake(async instance => [instance, 1]);
      const stubGetNextPrimaryKeyValue = sinon
        .stub(sequelize.queryInterface, 'getNextPrimaryKeyValue')
        .callsFake(async () => undefined);
      const User = sequelize.define('User', {
        phoneNumber: {
          type: DataTypes.STRING,
          set(val) {
            if (typeof val === 'object' && val !== null) {
              val = `00${val.country}${val.area}${val.local}`;
            }

            if (typeof val === 'string') {
              // Canonicalize phone number
              val = val.replace(/^\+/, '00').replaceAll(/\(0\)|[\s()+./-]/g, '');
            }

            this.setDataValue('phoneNumber', val);
          },
        },
      });

      return { stubCreate, stubGetNextPrimaryKeyValue, User };
    });

    after(() => {
      vars.stubCreate.restore();
      vars.stubGetNextPrimaryKeyValue.restore();
    });

    it('does not set field to changed if field is set to the same value with custom setter using primitive value', async () => {
      const user = vars.User.build({
        phoneNumber: '+1 234 567',
      });
      await user.save();
      expect(user.changed('phoneNumber')).to.be.false;

      user.set('phoneNumber', '+1 (0) 234567'); // Canonical equivalent of existing phone number
      expect(user.changed('phoneNumber')).to.be.false;
    });

    it('sets field to changed if field is set to the another value with custom setter using primitive value', async () => {
      const user = vars.User.build({
        phoneNumber: '+1 234 567',
      });
      await user.save();
      expect(user.changed('phoneNumber')).to.be.false;

      user.set('phoneNumber', '+1 (0) 765432'); // Canonical non-equivalent of existing phone number
      expect(user.changed('phoneNumber')).to.be.true;
    });

    it('does not set field to changed if field is set to the same value with custom setter using object', async () => {
      const user = vars.User.build({
        phoneNumber: '+1 234 567',
      });
      await user.save();
      expect(user.changed('phoneNumber')).to.be.false;

      user.set('phoneNumber', { country: '1', area: '234', local: '567' }); // Canonical equivalent of existing phone number
      expect(user.changed('phoneNumber')).to.be.false;
    });

    it('sets field to changed if field is set to the another value with custom setter using object', async () => {
      const user = vars.User.build({
        phoneNumber: '+1 234 567',
      });
      await user.save();
      expect(user.changed('phoneNumber')).to.be.false;

      user.set('phoneNumber', { country: '1', area: '765', local: '432' }); // Canonical non-equivalent of existing phone number
      expect(user.changed('phoneNumber')).to.be.true;
    });
  });
});
