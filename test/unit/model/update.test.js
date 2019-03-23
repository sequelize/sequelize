'use strict';

const { expect } = require('chai');
const Support = require('../support');
const current = Support.sequelize;
const sinon = require('sinon');
const DataTypes = require('../../../lib/data-types');

describe(Support.getTestDialectTeaser('Model'), () => {
  describe('method update', () => {
    before(function() {
      this.User = current.define('User', {
        name: DataTypes.STRING,
        secretValue: DataTypes.INTEGER
      });
    });

    beforeEach(function() {
      this.stubUpdate = sinon.stub(current.getQueryInterface(), 'bulkUpdate').resolves([]);
      this.updates = { name: 'Batman', secretValue: '7' };
      this.cloneUpdates = { ...this.updates };
    });

    afterEach(function() {
      this.stubUpdate.restore();
    });

    afterEach(function() {
      delete this.updates;
      delete this.cloneUpdates;
    });

    describe('properly clones input values', () => {
      it('with default options', function() {
        return this.User.update(this.updates, { where: { secretValue: '1' } }).then(() => {
          expect(this.updates).to.be.deep.eql(this.cloneUpdates);
        });
      });

      it('when using fields option', function() {
        return this.User.update(this.updates, { where: { secretValue: '1' }, fields: ['name'] }).then(() => {
          expect(this.updates).to.be.deep.eql(this.cloneUpdates);
        });
      });
    });

    it('can detect complexe objects', function() {
      const Where = function() { this.secretValue = '1'; };

      expect(() => {
        this.User.update(this.updates, { where: new Where() });
      }).to.throw();
    });
  });
});
