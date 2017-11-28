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

  describe('method update', () => {
    const User = current.define('User', {
      name: DataTypes.STRING,
      secretValue: DataTypes.INTEGER
    });

    before(function() {
      this.stubUpdate = sinon.stub(current.getQueryInterface(), 'bulkUpdate', () => {
        return Promise.resolve([]);
      });
    });

    beforeEach(function() {
      this.updates = { name: 'Batman', secretValue: '7' };
      this.cloneUpdates = _.clone(this.updates);
      this.stubUpdate.reset();
    });

    afterEach(function() {
      delete this.updates;
      delete this.cloneUpdates;
    });

    after(function() {
      this.stubUpdate.restore();
    });

    describe('properly clones input values', () => {
      it('with default options', function() {
        const self = this;
        return User.update(self.updates, {where: {secretValue: '1'}}).bind(this).then(() => {
          expect(self.updates).to.be.deep.eql(self.cloneUpdates);
        });
      });

      it('when using fields option', function() {
        const self = this;
        return User.update(self.updates, {where: {secretValue: '1'}, fields: ['name']}).bind(this).then(() => {
          expect(self.updates).to.be.deep.eql(self.cloneUpdates);
        });
      });
    });

    it('can detect complexe objects', function() {
      const self = this;
      const Where = function() { this.secretValue = '1'; };

      expect(() => {
        User.update(self.updates, {where: new Where()});
      }).to.throw();

    });
  });
});
