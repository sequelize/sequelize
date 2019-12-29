'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require(__dirname + '/../support'),
  current = Support.sequelize,
  DataTypes = require(__dirname + '/../../../lib/data-types');

describe(Support.getTestDialectTeaser('Model'), () => {
  describe('indexes', () => {
    it('should automatically set a gin index for JSONB indexes', () => {
      const Model = current.define('event', {
        eventData: {
          type: DataTypes.JSONB,
          index: true,
          field: 'data'
        }
      });

      expect(Model.rawAttributes.eventData.index).not.to.equal(true);
      expect(Model.options.indexes.length).to.equal(1);
      expect(Model.options.indexes[0].fields).to.eql(['data']);
      expect(Model.options.indexes[0].using).to.equal('gin');
    });

    it('should set the unique property when type is unique', () => {
      const Model = current.define('m', {}, {
        indexes: [
          {
            type: 'unique'
          },
          {
            type: 'UNIQUE'
          }
        ]
      });

      expect(Model.options.indexes[0].unique).to.eql(true);
      expect(Model.options.indexes[1].unique).to.eql(true);
    });

    it('should not set rawAttributes when indexes are defined via options', () => {
      const User = current.define('User', {
        username: DataTypes.STRING
      }, {
        indexes: [{
          unique: true,
          fields: ['username']
        }]
      });

      expect(User.rawAttributes.username.unique).to.be.undefined;
    });

    it('should not set rawAttributes when composite unique indexes are defined via options', () => {
      const User = current.define('User', {
        name: DataTypes.STRING,
        address: DataTypes.STRING
      }, {
        indexes: [{
          unique: 'users_name_address',
          fields: ['name', 'address']
        }]
      });

      expect(User.rawAttributes.name.unique).to.be.undefined;
      expect(User.rawAttributes.address.unique).to.be.undefined;
    });
  });
});
