var Utils   = require("../../utils")
  , sqlite3 = require('sqlite3').verbose()
  , Query   = require("./query")
  , util    = require("util")
  , events  = require("events")

module.exports = (function() {
  var ConnectorManager = function(sequelize, config) {
    events.EventEmitter.call(this)
    this.sequelize = sequelize
    
    // TODO: set the timezone based off the utcoffset we're given
    //if ( config.utcoffset != null )
      //process.env[ 'TZ' ] = config.utcoffset
      // TODO: verify that the TZ ends up being set
    this.database = this.client = new sqlite3.Database(sequelize.options.storage || ':memory:')
    this.isConnected = false
  }
  Utils._.extend(ConnectorManager.prototype, require("../connector-manager").prototype)
  util.inherits(ConnectorManager, events.EventEmitter)

  ConnectorManager.prototype.query = function(sql, callee, options) {
    if (!this.isConnected) {
      this.emit('connect', this.client)
      this.isConnected = true
    }
    return new Query(this, callee, options).run(sql)
  }

  return ConnectorManager
})()





