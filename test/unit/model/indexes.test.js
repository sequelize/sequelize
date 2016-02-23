'use strict';

/* jshint -W030 */
var chai = require('chai')
  , expect = chai.expect
  , Support = require(__dirname + '/../support')
  , current = Support.sequelize
  , DataTypes = require(__dirname + '/../../../lib/data-types');

describe(Support.getTestDialectTeaser('Model'), function() {
  describe('indexes', function () {
    it('should automatically set a gin index for JSONB indexes', function () {
      var Model = current.define('event', {
        eventData: {
          type: DataTypes.JSONB,
          index: true,
          field: 'data'
        }
      });

      expect(Model.rawAttributes.eventData.index).not.to.equal(true);
      expect(Model.options.indexes.length).to.equal(1);
      expect(Model.options.indexes[0].fields).to.eql(['data']);
      expect(Model.options.indexes[0].using).to.equal('gin');
    });
  });
});