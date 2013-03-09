var helpers = require('./../lib/helpers')

var extensions = function () {
  this.equalNumber = function (lambdaNum, num, desc) {
    return this.equal.call(this, helpers.toNumber(lambdaNum), num, desc)
  },

  this.isTrue = function (lambdaBool, desc) {
    return this.ok.call(this, helpers.toBoolean(lambdaBool), desc)
  },

  this.isFalse = function (lambdaBool, desc) {
    return this.ok.call(this, !helpers.toBoolean(lambdaBool), desc)
  }
}

module.exports = function (testName, testFn) {
  module.exports[testName] = function (test) {
    extensions.call(test)
    testFn.call(test, test)
    test.done()
  }
}