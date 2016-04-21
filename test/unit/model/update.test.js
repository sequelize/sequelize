'use strict';

/* jshint -W030 */
var chai = require('chai')
  , expect = chai.expect
  , Support = require(__dirname + '/../support')
  , current = Support.sequelize
  , sinon = require('sinon')
  , Promise = current.Promise
  , DataTypes = require('../../../lib/data-types')
  , _ = require('lodash');

describe(Support.getTestDialectTeaser('Model'), function() {

  describe('method update', function () {
    var User = current.define('User', {
      name: DataTypes.STRING,
      secretValue: DataTypes.INTEGER
    });

    before(function () {
      this.stubUpdate = sinon.stub(current.getQueryInterface(), 'bulkUpdate', function () {
        return Promise.resolve([]);
      });
    });

    beforeEach(function () {
      this.updates = { name: 'Batman', secretValue: '7' };
      this.cloneUpdates = _.clone(this.updates);
      this.stubUpdate.reset();
    });

    afterEach(function () {
      delete this.updates;
      delete this.cloneUpdates;
    });

    after(function () {
      this.stubUpdate.restore();
    });

    describe('properly clones input values', function () {
      it('with default options', function() {
        var self = this;
        return User.update(self.updates, {where: {secretValue: '1'}}).bind(this).then(function(e) {
          expect(self.updates).to.be.deep.eql(self.cloneUpdates);
        });
      });

      it('when using fields option', function() {
        var self = this;
        return User.update(self.updates, {where: {secretValue: '1'}, fields: ['name']}).bind(this).then(function() {
          expect(self.updates).to.be.deep.eql(self.cloneUpdates);
        });
      });
    });

    it('can detect complexe objects', function() {
      var self = this;
      var Where = function () { this.secretValue = '1'; };

      expect(function () {
        User.update(self.updates, {where:new Where()});
      }).to.throw();

    });
  });
});
