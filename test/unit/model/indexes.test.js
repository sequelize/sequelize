'use strict';

const chai = require('chai');

const expect = chai.expect;
const Support = require('../support');

const current = Support.sequelize;
const dialect = current.dialect;
const { DataTypes } = require('@sequelize/core');

describe(Support.getTestDialectTeaser('Model'), () => {
  describe('indexes', () => {
    if (dialect.supports.dataTypes.JSONB) {
      it('should automatically set a gin index for JSONB indexes', () => {
        const Model = current.define('event', {
          eventData: {
            type: DataTypes.JSONB,
            index: true,
            field: 'data',
          },
        });

        expect(Model.rawAttributes.eventData.index).not.to.equal(true);
        expect(Model.getIndexes().length).to.equal(1);
        expect(Model.getIndexes()[0].fields).to.eql(['data']);
        expect(Model.getIndexes()[0].using).to.equal('gin');
      });
    }

    it('should set the unique property when type is unique', () => {
      const Model = current.define('m', {}, {
        indexes: [
          {
            type: 'unique',
            fields: ['name'],
          },
          {
            type: 'UNIQUE',
            fields: ['name'],
          },
        ],
      });

      expect(Model.getIndexes()[0].unique).to.eql(true);
      expect(Model.getIndexes()[1].unique).to.eql(true);
    });

    it('should not set rawAttributes when indexes are defined via options', () => {
      const User = current.define('User', {
        username: DataTypes.STRING,
      }, {
        indexes: [{
          unique: true,
          fields: ['username'],
        }],
      });

      expect(User.rawAttributes.username.unique).to.be.undefined;
    });

    it('should not set rawAttributes when composite unique indexes are defined via options', () => {
      const User = current.define('User', {
        name: DataTypes.STRING,
        address: DataTypes.STRING,
      }, {
        indexes: [{
          unique: 'users_name_address',
          fields: ['name', 'address'],
        }],
      });

      expect(User.rawAttributes.name.unique).to.be.undefined;
      expect(User.rawAttributes.address.unique).to.be.undefined;
    });
  });
});
