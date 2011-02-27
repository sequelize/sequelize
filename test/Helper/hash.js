var Sequelize = require(__dirname + "/../../lib/sequelize/Sequelize").Sequelize
var h = Sequelize.Helper
var assert = require("assert")

module.exports = {
  'Hash: forEach': function() {
    var values = []
    var keys = []
    h.Hash.forEach({a:1, b:2, c:3}, function(value, key) {
      values.push(value)
      keys.push(key)
    })
    assert.eql(values, [1,2,3])
    assert.eql(keys, ['a', 'b', 'c'])
  },
  'Hash: map': function() {
    var hash = {a:1, b:2, c:3}
    assert.eql(h.Hash.map(hash, function(value, key) {return value}), [1,2,3])
    assert.eql(h.Hash.map(hash, function(value, key) {return key}), ['a','b','c'])
  },
  'Hash: keys': function() {
    assert.eql(h.Hash.keys({a:1,b:2}), ['a', 'b'])
  },
  'Hash: values': function() {
    assert.eql(h.Hash.values({a:1,b:2}), [1,2])
  },
  'Hash: merge': function() {
    var src = {a:1, b:2}
    var target = {b:3, c:3}

    assert.eql(h.Hash.merge(src, target), {a:1, b:3, c:3})
    assert.eql(h.Hash.merge(src, target, true), {a:1, b:2, c:3})
  },
  'Hash: without': function() {
    var hash = {a: 1, b: 2}
    assert.eql(h.Hash.without(hash, ["a"]), {b: 2})
  },
  'Hash: isHash': function() {
    assert.eql(h.Hash.isHash([1,2]), false)
    assert.eql(h.Hash.isHash(1), false)
    assert.eql(h.Hash.isHash("asd"), false)
    assert.eql(h.Hash.isHash({a:1}), true)
  }
}