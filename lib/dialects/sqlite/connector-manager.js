var sqlite3
  , Utils   = require("../../utils")
  , Query   = require("./query")

module.exports = (function() {
  var ConnectorManager = function(sequelize, config) {
    this.sequelize = sequelize
    this.config    = config

    if (config.dialectModulePath) {
      sqlite3 = require(config.dialectModulePath).verbose()
    } else {
      sqlite3 = require('sqlite3').verbose()
    }
  }

  Utils._.extend(ConnectorManager.prototype, require("../connector-manager").prototype)

  ConnectorManager.prototype.connect = function() {
    var emitter = new (require('events').EventEmitter)()
      , self = this
      , db

    this.database = db = new sqlite3.Database(self.sequelize.options.storage || ':memory:', function(err) {
      if (err) {
        if (err.code === "SQLITE_CANTOPEN") {
          emitter.emit('error', 'Failed to find SQL server. Please double check your settings.')
        }
      }

      if(!err && self.sequelize.options.foreignKeys !== false) {
        // Make it possible to define and use foreign key constraints unless
        // explicitly disallowed. It's still opt-in per relation
        db.run('PRAGMA FOREIGN_KEYS=ON')
      }
    })
  }

  ConnectorManager.prototype.query = function(sql, callee, options) {
    if (!this.database) {
      this.connect()
    }

    return new Query(this.database, this.sequelize, callee, options).run(sql)
  }

  return ConnectorManager
})()
