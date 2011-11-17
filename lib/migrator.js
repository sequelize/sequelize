module.exports = (function() {
  var Migrator = function(options) {
    this.options = Utils._.extend({
      path: __dirname + '/../migrations',
      from: null,
      to: null
    }, _options || {})
  }

  Migrator.prototype.migrate = function() {

  }

  // private

  var getLastMigrationId = function() {

  }

  return Migrator
})()
