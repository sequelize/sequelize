var fs    = require("fs")
  , path  = require("path")
  , Utils = require("./utils")

module.exports = (function() {
  var Migrator = function(options) {
    this.options = Utils._.extend({
      path: __dirname + '/../migrations',
      from: null,
      to: null
    }, options || {})
  }

  Migrator.prototype.migrate = function() {
    getLastMigrationId.call(this)
  }

  // private

  var getLastMigrationId = function() {
    var result = null

    fs.readdirSync(this.options.path).filter(function(file) {
      console.log(file)
    })
  }

  return Migrator
})()
