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

  describe('method destroy', function () {
    var User = current.define('User', {
      name: DataTypes.STRING,
      secretValue: DataTypes.INTEGER
    });

    before(function () {
      this.stubUpdate = sinon.stub(current.getQueryInterface(), 'bulkDelete', function () {
        return Promise.resolve([]);
      });
    });

    beforeEach(function () {
      this.options = {where: {secretValue: '1'}}
      this.cloneOptions = _.clone(this.options);
      this.stubUpdate.reset();
    });

    afterEach(function () {
      delete this.options;
      delete this.cloneOptions;
    });

    after(function () {
      this.stubUpdate.restore();
    });

    it('properly clones options', function() {
      var self = this;
      return User.destroy(self.options).bind(this).then(function(e) {
        expect(self.options).to.be.deep.eql(self.cloneOptions);
      });
    });

    it('can detect complexe objects', function() {
      var self = this;
      var where = function () { this.secretValue = '1'; }
      return expect(User.destroy({where:new where})).to.eventually.be.rejectedWith(Error);
    });
  });
});
