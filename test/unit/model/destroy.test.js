'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require('../support'),
  current = Support.sequelize,
  sinon = require('sinon'),
  DataTypes = require('sequelize/lib/data-types');

describe(Support.getTestDialectTeaser('Model'), () => {

  describe('method destroy', () => {
    const User = current.define('User', {
      name: DataTypes.STRING,
      secretValue: DataTypes.INTEGER
    });

    before(function() {
      this.stubDelete = sinon.stub(current.getQueryInterface(), 'bulkDelete').resolves([]);
    });

    beforeEach(function() {
      this.deloptions = { where: { secretValue: '1' } };
      this.cloneOptions = { ...this.deloptions };
      this.stubDelete.resetHistory();
    });

    afterEach(function() {
      delete this.deloptions;
      delete this.cloneOptions;
    });

    after(function() {
      this.stubDelete.restore();
    });

    it('can detect complex objects', async () => {
      const Where = function() { this.secretValue = '1'; };

      await expect(User.destroy({ where: new Where() })).to.be.rejected;
    });
  });
});
