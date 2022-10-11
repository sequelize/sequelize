'use strict';

const chai = require('chai');

const expect = chai.expect;
const Support   = require('../support');

const current   = Support.sequelize;

describe(Support.getTestDialectTeaser('Instance'), () => {
  describe('update', () => {
    it('is not allowed if the primary key is not defined', async () => {
      const User = current.define('User', {});
      const instance = User.build({}, { isNewRecord: false });

      await expect(instance.update()).to.be.rejectedWith('You attempted to save an instance with no primary key, this is not allowed since');
    });
  });
});
