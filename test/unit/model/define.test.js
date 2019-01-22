'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require(__dirname + '/../support'),
  DataTypes = require('../../../lib/data-types'),
  current = Support.sequelize;

describe(Support.getTestDialectTeaser('Model'), () => {
  describe('define', () => {
    it('should allow custom timestamps with underscored: true', () => {
      const Model = current.define('User', {}, {
        createdAt: 'createdAt',
        updatedAt: 'updatedAt',
        timestamps: true,
        underscored: true
      });

      expect(Model.rawAttributes).to.haveOwnProperty('createdAt');
      expect(Model.rawAttributes).to.haveOwnProperty('updatedAt');

      expect(Model._timestampAttributes.createdAt).to.equal('createdAt');
      expect(Model._timestampAttributes.updatedAt).to.equal('updatedAt');

      expect(Model.rawAttributes).not.to.have.property('created_at');
      expect(Model.rawAttributes).not.to.have.property('updated_at');
    });

    it('should underscore camelCased attributes with underscored: true', () => {
      const Model = current.define('User', { fieldName: { type: DataTypes.TEXT } }, { underscored: true });

      expect(Model.rawAttributes.fieldName.field).to.equal('field_name');
    });

    it('should underscore camelCased attributes with underscoredAll: true', () => {
      const Model = current.define('User', { fieldName: { type: DataTypes.TEXT } }, { underscoredAll: true });

      expect(Model.rawAttributes.fieldName.field).to.equal('field_name');
    });

    it('should not underscore attributes where field is already set', () => {
      const Model = current.define('User', { fieldName: { type: DataTypes.TEXT, field: 'forcedFieldName' } }, { underscoredAll: true });

      expect(Model.rawAttributes.fieldName.field).to.equal('forcedFieldName');
    });

    it('should throw when id is added but not marked as PK', () => {
      expect(() => {
        current.define('foo', {
          id: DataTypes.INTEGER
        });
      }).to.throw("A column called 'id' was added to the attributes of 'foos' but not marked with 'primaryKey: true'");

      expect(() => {
        current.define('bar', {
          id: {
            type: DataTypes.INTEGER
          }
        });
      }).to.throw("A column called 'id' was added to the attributes of 'bars' but not marked with 'primaryKey: true'");
    });
    it('should defend against null or undefined "unique" attributes', () => {
      expect(() => {
        current.define('baz', {
          foo: {
            type: DataTypes.STRING,
            unique: null
          },
          bar: {
            type: DataTypes.STRING,
            unique: undefined
          },
          bop: {
            type: DataTypes.DATE
          }
        });
      }).not.to.throw();
    });
  });
});
