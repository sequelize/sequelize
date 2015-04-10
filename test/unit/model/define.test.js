'use strict';

/* jshint -W030 */
var chai = require('chai')
  , expect = chai.expect
  , Support   = require(__dirname + '/../support')
  , current   = Support.sequelize;

describe(Support.getTestDialectTeaser('Model'), function() {
  describe('define', function () {
    it('should allow custom timestamps with underscored: true', function () {
      var Model;

      Model = current.define('User', {}, {
        createdAt   : 'createdAt',
        updatedAt   : 'updatedAt',
        timestamps  : true,
        underscored : true
      });

      expect(Model.rawAttributes.createdAt).to.be.defined;
      expect(Model.rawAttributes.updatedAt).to.be.defined;

      expect(Model._timestampAttributes.createdAt).to.equal('createdAt');
      expect(Model._timestampAttributes.updatedAt).to.equal('updatedAt');

      expect(Model.rawAttributes.created_at).not.to.be.defined;
      expect(Model.rawAttributes.updated_at).not.to.be.defined;
    });
  });
});