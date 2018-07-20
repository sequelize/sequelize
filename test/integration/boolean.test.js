'use strict';

const chai = require('chai'),
  Sequelize = require('../../index'),
  expect = chai.expect,
  Support = require(__dirname + '/support'),
  DataTypes = require(__dirname + '/../../lib/data-types');


describe(Support.getTestDialectTeaser('Boolean'), () => {
  describe('create', () => {
    it('should work with booleans" ', async function() {
      const User = this.sequelize.define('User', {
        'id': {
          primaryKey: true,
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4
        },
        'someBool': {
          type: DataTypes.BOOLEAN,
          defaultValue: true
        }
      });
      await this.sequelize.sync({force: true})
      let user = await User.create({})
      user = await user.save()
      user = await user.reload()
      expect(user.someBool).to.equal(true);
    });
  });
});
