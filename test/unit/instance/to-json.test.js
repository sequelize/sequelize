'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support   = require('../support'),
  DataTypes = require('sequelize/lib/data-types'),
  current   = Support.sequelize;

describe(Support.getTestDialectTeaser('Instance'), () => {
  describe('toJSON', () => {
    it('returns copy of json', () => {
      const User = current.define('User', {
        name: DataTypes.STRING
      });
      const user = User.build({ name: 'my-name' });
      const json1 = user.toJSON();
      expect(json1).to.have.property('name').and.be.equal('my-name');

      // remove value from json and ensure it's not changed in the instance
      delete json1.name;

      const json2 = user.toJSON();
      expect(json2).to.have.property('name').and.be.equal('my-name');
    });

    it('returns clone of JSON data-types', () => {
      const User = current.define('User', {
        name: DataTypes.STRING,
        permissions: DataTypes.JSON
      });
      const user = User.build({ name: 'my-name', permissions: { admin: true, special: 'foobar' } });
      const json = user.toJSON();

      expect(json)
        .to.have.property('permissions')
        .that.does.not.equal(user.permissions);

      json.permissions.admin = false;

      expect(user.permissions)
        .to.have.property('admin')
        .that.equals(true);
    });
  });
});
