var Utils = require("../utils")

module.exports = (function() {
  var Query = function(database, callee, options) {
    throw new Error('Constructor was not overwritten!')
  }
  Utils._.extend(Query.prototype, require("../emitters/custom-event-emitter").prototype)

  Query.prototype.run = function(sql) {
    throw new Error("The run method wasn't overwritten!")
  }

  Query.prototype.success = Query.prototype.ok = function(fct) {
    this.on('success', fct)
    return this
  }

  Query.prototype.failure = Query.prototype.fail = Query.prototype.error = function(fct) {
    this.on('failure', fct)
    return this
  }


  return Query
})()
