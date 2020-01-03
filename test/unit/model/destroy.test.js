'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require('../support'),
  current = Support.sequelize,
  sinon = require('sinon'),
  DataTypes = require('../../../lib/data-types'),
  _ = require('lodash');

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
      this.cloneOptions = _.clone(this.deloptions);
      this.stubDelete.resetHistory();
    });

    afterEach(function() {
      delete this.deloptions;
      delete this.cloneOptions;
    });

    after(function() {
      this.stubDelete.restore();
    });

    it('can detect complex objects', () => {
      const Where = function() { this.secretValue = '1'; };

      expect(() => {
        User.destroy({ where: new Where() });
      }).to.throw();

    });
  });
});
