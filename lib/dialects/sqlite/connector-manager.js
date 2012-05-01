var Utils   = require("../../utils")
  , sqlite3 = require('sqlite3').verbose()
  , Query   = require("./query")

module.exports = (function() {
  var ConnectorManager = function(sequelize) {
    events.EventEmitter.call(this)
    this.sequelize = sequelize
    if ( config.timezone != null )
      process.env[ 'TZ' ] = config.timezone
      // TODO: verify that the TZ ends up being set
    this.database  = new sqlite3.Database(sequelize.options.storage || ':memory:')
  }
  Utils._.extend(ConnectorManager.prototype, require("../connector-manager").prototype)

  ConnectorManager.prototype.query = function(sql, callee, options) {
    return new Query(this.database, callee, options).run(sql)
  }

  return ConnectorManager
})()





