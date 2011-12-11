var Utils = require("../../utils")
  , util  = require("util")

module.exports = (function() {
  var QueryGenerator = {

  }

  return Utils._.extend(Utils._.clone(require("../query-generator")), QueryGenerator)
})
