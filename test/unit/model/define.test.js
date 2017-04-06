'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support   = require(__dirname + '/../support'),
  DataTypes = require('../../../lib/data-types'),
  current   = Support.sequelize;

describe(Support.getTestDialectTeaser('Model'), () => {
  describe('define', () => {
    it('should allow custom timestamps with underscored: true', () => {
      const Model = current.define('User', {}, {
        createdAt   : 'createdAt',
        updatedAt   : 'updatedAt',
        timestamps  : true,
        underscored : true
      });

      expect(Model.rawAttributes.createdAt).to.be.defined;
      expect(Model.rawAttributes.updatedAt).to.be.defined;

      expect(Model._timestampAttributes.createdAt).to.equal('createdAt');
      expect(Model._timestampAttributes.updatedAt).to.equal('updatedAt');

      expect(Model.rawAttributes.created_at).not.to.be.defined;
      expect(Model.rawAttributes.updated_at).not.to.be.defined;
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
  });
});
