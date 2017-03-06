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
        text: DataTypes.STRING,
        textCustom: {
          type: DataTypes.STRING,
          set: function (val) {
            this.setDataValue('textCustom', val);
          },
          get: function () {
            this.getDataValue('textCustom');
          }
        }
      });

      var instance = Model.build({ text: 'a', textCustom: 'abc' });
      expect(instance.previous('text')).to.be.not.ok;
      expect(instance.previous('textCustom')).to.be.not.ok;

      instance.set('text', 'b');
      instance.set('textCustom', 'def');

      expect(instance.previous('text')).to.be.equal('a');
      expect(instance.previous('textCustom')).to.be.equal('abc');
    });
  });
});
