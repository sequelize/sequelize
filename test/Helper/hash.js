var Sequelize = require(__dirname + "/../../lib/sequelize/Sequelize").Sequelize
var h = Sequelize.Helper

module.exports = {
  'Hash: forEach': function(assert) {
    var values = []
    var keys = []
    h.Hash.forEach({a:1, b:2, c:3}, function(value, key) {
      values.push(value)
      keys.push(key)
    })
    assert.eql(values, [1,2,3])
    assert.eql(keys, ['a', 'b', 'c'])
  },
  'Hash: map': function(assert) {
    var hash = {a:1, b:2, c:3}
    assert.eql(h.Hash.map(hash, function(value, key) {return value}), [1,2,3])
    assert.eql(h.Hash.map(hash, function(value, key) {return key}), ['a','b','c'])
  },
  'Hash: keys': function(assert) {
    assert.eql(h.Hash.keys({a:1,b:2}), ['a', 'b'])
  },
  'Hash: values': function(assert) {
    assert.eql(h.Hash.values({a:1,b:2}), [1,2])
  },
  'Hash: merge': function(assert) {
    var src = {a:1, b:2}
    var target = {b:3, c:3}

    assert.eql(h.Hash.merge(src, target), {a:1, b:3, c:3})
    assert.eql(h.Hash.merge(src, target, true), {a:1, b:2, c:3})
  },
  'Hash: without': function(assert) {
    var hash = {a: 1, b: 2}
    assert.eql(h.Hash.without(hash, ["a"]), {b: 2})
  }
}