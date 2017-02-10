'use strict';

/* jshint -W030 */
var chai = require('chai')
  , expect = chai.expect
  , Support   = require(__dirname + '/../support')
  , DataTypes = require(__dirname + '/../../../lib/data-types')
  , current   = Support.sequelize;

describe(Support.getTestDialectTeaser('Instance'), function () {
  describe('previous', function () {
    it('should return correct previous value', function () {
      var Model = current.define('Model', {
          text: {
            type: DataTypes.STRING,
            get: function (name) {
              return this.getDataValue(name);
            },
            set: function (value, name) {
              this.setDataValue(name, value);
            }
          }
        })
        , instance
        , shouldBeEmpty
        , shouldBeA;

      instance = Model.build({ text: 'a' }, {
        isNewRecord: false
      });

      shouldBeEmpty = instance.previous('text');

      instance.set('text', 'b');

      shouldBeA = instance.previous('text');

      expect(shouldBeEmpty).to.be.not.ok;
      expect(shouldBeA).to.be.equal('a');
    });
  });
});
