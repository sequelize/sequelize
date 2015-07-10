'use strict';

/* jshint -W030 */
var chai = require('chai')
  , expect = chai.expect
  , Support   = require(__dirname + '/../support')
  , current   = Support.sequelize
  , _ = require('lodash')
  , DataTypes = require(__dirname + '/../../../lib/data-types');

describe(Support.getTestDialectTeaser('Model'), function() {
  describe('removeAttribute', function () {
    it('should support removing the primary key', function () {
      var Model = current.define('m', {
        name: DataTypes.STRING
      });

      expect(Model.primaryKeyAttribute).not.to.be.undefined;
      expect(_.size(Model.primaryKeys)).to.equal(1);

      Model.removeAttribute('id');

      expect(Model.primaryKeyAttribute).to.be.undefined;
      expect(_.size(Model.primaryKeys)).to.equal(0);
    });
  });
});
