var Utils   = require("../../utils")
  , sqlite3 = require('sqlite3').verbose()
  , events = require('events')
  , util = require('util')
  , Query   = require("./query")

module.exports = (function() {
  var ConnectorManager = function(sequelize) {
    events.EventEmitter.call(this)
  
    this.sequelize = sequelize
    this.database  = new sqlite3.Database(sequelize.options.storage || ':memory:')
    this.isConnected = false
  }
  Utils._.extend(ConnectorManager.prototype, require("../connector-manager").prototype)
  util.inherits(ConnectorManager, events.EventEmitter)

  ConnectorManager.prototype.query = function(sql, callee, options) {
    if (!this.isConnected) {
        this.emit( 'connect', this.database )
        this.isConnected = true
    }
    return new Query(this.database, callee, options).run(sql)
  }

  return ConnectorManager
})()





