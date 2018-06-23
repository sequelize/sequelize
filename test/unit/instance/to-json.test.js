'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support   = require(__dirname + '/../support'),
  DataTypes = require(__dirname + '/../../../lib/data-types'),
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
  });
});
