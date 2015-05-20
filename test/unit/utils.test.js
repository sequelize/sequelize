'use strict';

/* jshint -W030 */
/* jshint -W110 */
var chai = require('chai')
  , expect = chai.expect
  , Utils = require(__dirname + '/../../lib/utils')
  , Support = require(__dirname + '/support');

describe(Support.getTestDialectTeaser('Utils'), function() {
  describe('formatReferences', function () {
    ([
      [{referencesKey: 1}, {references: {model: undefined, key: 1}, referencesKey: undefined}],
      [{references: 'a'}, {references: {model: 'a', key: undefined}, referencesKey: undefined}],
      [{references: 'a', referencesKey: 1}, {references: {model: 'a', key: 1}, referencesKey: undefined}],
      [{references: {model: 1}}, {references: {model: 1}}]
    ]).forEach(function (test) {
      var input  = test[0];
      var output = test[1];

      it('converts ' + JSON.stringify(input) + ' to ' + JSON.stringify(output), function () {
        expect(Utils.formatReferences(input)).to.deep.equal(output);
      });
    });
  });
});
