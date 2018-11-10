'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require(__dirname + '/../support'),
  current = Support.sequelize,
  sinon = require('sinon'),
  Promise = current.Promise,
  DataTypes = require('../../../lib/data-types'),
  _ = require('lodash');

describe(Support.getTestDialectTeaser('Model'), () => {

  describe('method destroy', () => {
    const User = current.define('User', {
      name: DataTypes.STRING,
      secretValue: DataTypes.INTEGER
    });

    before(function() {
      this.stubDelete = sinon.stub(current.getQueryInterface(), 'bulkDelete').callsFake(() => {
        return Promise.resolve([]);
      });
    });

    beforeEach(function() {
      this.deloptions = {where: {secretValue: '1'}};
      this.cloneOptions = _.clone(this.deloptions);
      this.stubDelete.reset();
    });

    afterEach(function() {
      delete this.deloptions;
      delete this.cloneOptions;
    });

    after(function() {
      this.stubDelete.restore();
    });

    it('can detect complexe objects', () => {
      const Where = function() { this.secretValue = '1'; };

      expect(() => {
        User.destroy({where: new Where()});
      }).to.throw();

    });
  });
});
