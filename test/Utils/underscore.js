var assert = require("assert")
  , Utils  = require("../../lib/utils")

module.exports = {
  'underscoredIf should be defined': function() {
    assert.isDefined(Utils._.underscoredIf)
  },
  'underscoredIf should work correctly': function() {
    assert.eql(Utils._.underscoredIf('fooBar', false), 'fooBar')
    assert.eql(Utils._.underscoredIf('fooBar', true), 'foo_bar')
  },
  'camelizeIf should be defined': function() {
    assert.isDefined(Utils._.camelizeIf)
  },
  'camelizeIf should work correctly': function() {
    assert.eql(Utils._.camelizeIf('foo_bar', false), 'foo_bar')
    assert.eql(Utils._.camelizeIf('foo_bar', true), 'fooBar')
  }
}
