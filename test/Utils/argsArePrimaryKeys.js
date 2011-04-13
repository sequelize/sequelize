var assert = require("assert")
  , Utils  = require("../../lib/sequelize/utils")

module.exports = {
  'it should be false if primaryKeys and args have different lengths': function() {
    assert.eql(false, Utils.argsArePrimaryKeys([1,2,3], [1]))
  },
  'it should be false if primaryKeys are hashes or arrays': function() {
    assert.eql(false, Utils.argsArePrimaryKeys([[]], [1]))
  },
  'it should be true if primaryKeys are primitive data types and lengths are matching': function() {
    assert.eql(true, Utils.argsArePrimaryKeys([1,2,3], ["INT", "INT", "INT"]))
  },
  'it should be true if primaryKeys are dates and lengths are matching': function() {
    assert.eql(true, Utils.argsArePrimaryKeys([new Date()], ['foo']))
  }
}