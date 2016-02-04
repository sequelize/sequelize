'use strict';

/* jshint -W030 */
/* jshint -W110 */
var chai = require('chai')
  , expect = chai.expect
  , Support = require(__dirname + '/../../support')
  , DataTypes = require(__dirname + '/../../../lib/data-types');

describe(Support.getTestDialectTeaser('Model'), function() {

  describe('not breaking built-ins', function() {
    it('it should not break instance.set by defining a model set attribute', function() {
      var User = this.sequelize.define('OverWrittenKeys', {
        set:DataTypes.STRING
      });

      var user = User.build({set: 'A'});
      expect(user.get('set')).to.equal('A');
      user.set('set', 'B');
      expect(user.get('set')).to.equal('B');
    });
  });
});
