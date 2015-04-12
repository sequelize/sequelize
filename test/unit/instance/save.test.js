'use strict';

var chai = require('chai')
  , expect = chai.expect
  , Support   = require(__dirname + '/../support')
  , DataTypes = require(__dirname + '/../../../lib/data-types')
  , current   = Support.sequelize;

describe(Support.getTestDialectTeaser('Instance'), function() {
  describe('save', function () {
    it('should disallow saves if no primary key values is present', function () {
      var Model = current.define('User', {
      
      })
        , instance;

      instance = Model.build({}, {isNewRecord: false});

      expect(function () {
        instance.save()
      }).to.throw();
    });
  });
});